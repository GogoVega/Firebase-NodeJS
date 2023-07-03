/**
 * @license
 * Copyright 2023 Gauthier Dandele
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FirebaseApp } from "firebase/app";
import * as database from "firebase/database";
import {
	Database,
	DataSnapshot,
	get,
	getDatabase,
	goOffline,
	goOnline,
	onDisconnect,
	query,
	QueryConstraint,
	ref,
} from "firebase/database";
import { App } from "firebase-admin/app";
import {
	Database as AdminDatabase,
	DataSnapshot as AdminDataSnapshot,
	getDatabase as adminGetDatabase,
} from "firebase-admin/database";
import { TypedEmitter } from "tiny-typed-emitter";
import { RTDBError } from "./rtdb-error";
import { AdminClient, BaseClient } from "../client";
import { Connection } from "../connection";
import {
	DBRef,
	Listener,
	ListenerMap,
	OnDisconnectMethod,
	OnDisconnectMethodMap,
	OnDisconnectSignature,
	QueryConstraintType,
	QueryMethod,
	QueryMethodMap,
	QuerySignature,
	RTDBEvents,
	Unsubscription,
} from "../types/rtdb/rtdb";
import { Entry } from "../types/utils/util-type";
import { printEnumKeys } from "../utils";

export class RTDB extends TypedEmitter<RTDBEvents> {
	private _database!: AdminDatabase | Database;
	private _connection: Connection;

	constructor(public readonly client: AdminClient | BaseClient) {
		if (!(client instanceof AdminClient) && !(client instanceof BaseClient))
			throw new TypeError("RTDB must be instantiated with Client as parameter");

		super();
		this.getDatabase();
		this._connection = new Connection(this);
	}

	public get connectionState() {
		return this._connection.state;
	}

	public get database() {
		return this._database;
	}

	protected applyQueryConstraints(constraints?: QueryConstraintType): QueryConstraint[];
	protected applyQueryConstraints(constraints: QueryConstraintType | undefined, dbRef: DBRef): DBRef;
	protected applyQueryConstraints(constraints: QueryConstraintType = {}, dbRef?: DBRef) {
		const query = [];

		if (typeof constraints !== "object") throw new TypeError("Query Constraint must be an Object!");

		for (const [method, value] of Object.entries(constraints) as Entry<QueryConstraintType>[]) {
			switch (method) {
				case "endAt":
				case "endBefore":
				case "equalTo":
				case "startAfter":
				case "startAt":
					if (typeof value !== "object")
						throw new TypeError(`The value of the "${method}" constraint must be an object!`);
					if (value.value === undefined)
						throw new TypeError(`The value of the "${method}" constraint must be an object containing "value" as key.`);
					if (
						typeof value.value !== "string" &&
						typeof value.value !== "boolean" &&
						typeof value.value !== "number" &&
						value.value !== null
					)
						throw new TypeError(
							`The value of the "${method}.value" constraint must be a boolean, number, string or null!`
						);

					if (value.key === null || (value.key && typeof value.key !== "string"))
						throw new TypeError(`The value of the "${method}.key" constraint must be a string!`);

					if (dbRef) {
						dbRef = dbRef[method](value.value, value.key);
					} else {
						query.push(database[method](value.value, value.key));
					}
					break;
				case "limitToFirst":
				case "limitToLast":
					if (typeof value !== "number")
						throw new TypeError(`The value of the "${method}" constraint must be a number!`);

					if (dbRef) {
						dbRef = dbRef[method](value);
					} else {
						query.push(database[method](value));
					}
					break;
				case "orderByChild":
					if (typeof value !== "string")
						throw new TypeError(`The value of the "${method}" constraint must be a string!`);

					if (dbRef) {
						dbRef = dbRef[method](value);
					} else {
						query.push(database[method](value));
					}
					break;
				case "orderByKey":
				case "orderByPriority":
				case "orderByValue":
					if (value !== null) throw new TypeError(`The value of the "${method}" constraint must be null!`);

					if (dbRef) {
						dbRef = dbRef[method]();
					} else {
						query.push(database[method]());
					}
					break;
				default:
					throw new Error(`Query constraint received: "${method}" is invalid!`);
			}
		}

		return dbRef || query;
	}

	protected checkOnDisconnectQueryMethod(method: unknown) {
		if (method === undefined) throw new TypeError("On Disconnect Query Method do not exist!");
		if (typeof method !== "string") throw new TypeError("On Disconnect Query Method must be a string!");
		if (method in OnDisconnectMethodMap) return method as OnDisconnectMethod;

		throw new Error(`On Disconnect Query Method must be one of ${printEnumKeys(OnDisconnectMethodMap)}.`);
	}

	/**
	 * Checks path to match Firebase rules. Throws an error if does not match.
	 * @param path The path to check
	 * @param empty Can the path be empty? Default: `false`
	 * @returns The path checked to the database
	 */
	protected checkPath(path: unknown, empty: true): string | undefined;

	/**
	 * Checks path to match Firebase rules. Throws an error if does not match.
	 * @param path The path to check
	 * @param empty Can the path be empty? Default: `false`
	 * @returns The path checked to the database
	 */
	protected checkPath(path: unknown, empty?: false): string;

	protected checkPath(path: unknown, empty?: boolean) {
		if (empty && path === undefined) return;
		if (!empty && path === undefined) throw new TypeError("The PATH do not exist!");
		if (!empty && !path) throw new TypeError("PATH must be non-empty string!");
		if (typeof path !== "string") throw new TypeError("PATH must be a string!");
		if (path.match(/[.#$\[\]]/g)) throw new Error(`PATH must not contain ".", "#", "$", "[", or "]"`);
		return path.trim() || undefined;
	}

	/**
	 * Checks if the priority is valid otherwise throws an error.
	 * @param priority The priority to be checked
	 * @returns The priority checked
	 */
	protected checkPriority(priority: unknown) {
		if (priority === null) return priority;
		if (priority === undefined) throw new TypeError("The Priority do not exist!");
		if (typeof priority === "number" && Number.isInteger(priority) && priority > 0) return priority;
		if (typeof priority === "string") {
			const number = Number(priority);
			if (Number.isInteger(number) && number > 0) return number;
		}

		throw new TypeError("The priority must be an INTEGER > 0!");
	}

	/**
	 * Checks if the Query Method is valid otherwise throws an error.
	 * @param method The Query Method to be checked
	 * @returns The Query Method checked
	 */
	protected checkQueryMethod(method: unknown) {
		if (method === undefined) throw new TypeError("Query Method do not exist!");
		if (typeof method !== "string") throw new TypeError("Query Method must be a string!");
		if (method in QueryMethodMap) return method as QueryMethod;

		throw new Error(`Query Method must be one of ${printEnumKeys(QueryMethodMap)}.`);
	}

	public doGetQuery(path?: string, constraints?: object) {
		const pathParsed = this.checkPath(path, true);

		if (this.isAdmin(this.database)) {
			const database = pathParsed ? this.database.ref().child(pathParsed) : this.database.ref();

			return this.applyQueryConstraints(constraints, database).get();
		}

		return get(query(ref(this.database, pathParsed), ...this.applyQueryConstraints(constraints)));
	}

	public doSubscriptionQuery(
		listener: Listener,
		callback: (snapshot: AdminDataSnapshot | DataSnapshot, previousChildName?: string | null) => void,
		path?: string,
		constraints?: QueryConstraintType
	): Unsubscription {
		const pathParsed = this.checkPath(path, true);

		if (typeof callback !== "function") throw new TypeError("The callback must be a function");
		if (!(listener in ListenerMap)) throw new Error(`The listener "${listener}" is invalid!`);

		if (this.isAdmin(this._database)) {
			const databaseRef = pathParsed ? this._database.ref().child(pathParsed) : this._database.ref();

			return this.applyQueryConstraints(constraints, databaseRef).on(listener, callback, (error) => {
				throw error;
			});
		} else {
			return database[ListenerMap[listener]](
				query(ref(this._database, pathParsed), ...this.applyQueryConstraints(constraints)),
				callback,
				(error: Error) => {
					throw error;
				}
			);
		}
	}

	public doUnSubscriptionQuery(listener: Listener, unsubscriptionCallback?: Unsubscription, path?: string) {
		const pathParsed = this.checkPath(path, true);

		if (typeof unsubscriptionCallback !== "function")
			throw new TypeError("The unsubscriptionCallback must be a function");
		if (!(listener in ListenerMap)) throw new Error(`The listener "${listener}" is invalid!`);

		if (this.isAdmin(this._database)) {
			const databaseRef = pathParsed ? this._database.ref().child(pathParsed) : this._database.ref();

			if (unsubscriptionCallback) databaseRef.off(listener, unsubscriptionCallback);
		} else {
			if (unsubscriptionCallback) (unsubscriptionCallback as () => void)();
		}
	}

	public async doWriteQuery<K extends keyof QuerySignature>(method: K, path: string, ...args: QuerySignature[K]) {
		const methodParsed = this.checkQueryMethod(method);
		const pathParsed = this.checkPath(path, false);
		const [value, priority] = args;

		if (this.isAdmin(this._database)) {
			switch (methodParsed) {
				case "update":
					if (value && typeof value === "object") {
						await this._database.ref().child(pathParsed)[methodParsed](value);
						break;
					}

					throw new TypeError('The value to write must be an object with "update" query');
				case "remove":
					await this._database.ref().child(pathParsed)[methodParsed]();
					break;
				case "setPriority":
					await this._database
						.ref()
						.child(pathParsed)
						.setPriority(this.checkPriority(priority), (err) => {
							if (err) throw err;
						});
					break;
				case "setWithPriority":
					await this._database.ref().child(pathParsed)[methodParsed](value, this.checkPriority(priority));
					break;
				default:
					await this._database.ref().child(pathParsed)[methodParsed](value);
					break;
			}
		} else {
			switch (methodParsed) {
				case "update":
					if (value && typeof value === "object") {
						await database[methodParsed](ref(this._database, pathParsed), value);
						break;
					}

					throw new TypeError('The value to write must be an object with "update" query.');
				case "remove":
					await database[methodParsed](ref(this._database, pathParsed));
					break;
				case "setPriority":
					await database[methodParsed](ref(this._database, pathParsed), this.checkPriority(priority));
					break;
				case "setWithPriority":
					await database[methodParsed](ref(this._database, pathParsed), value, this.checkPriority(priority));
					break;
				default:
					await database[methodParsed](ref(this._database, pathParsed), value);
					break;
			}
		}
	}

	private getDatabase() {
		if (!this.client.clientInitialised) throw new RTDBError("RTDB is called before the Client is initialized");

		this._database = this.isAdminApp(this.client.app)
			? adminGetDatabase(this.client.app)
			: getDatabase(this.client.app);
	}

	public goOffline() {
		this._database instanceof Database ? goOffline(this._database) : this._database.goOffline();
	}

	public goOnline() {
		this._database instanceof Database ? goOnline(this._database) : this._database.goOnline();
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	protected isAdmin(db: AdminDatabase | Database): db is AdminDatabase {
		if (this.client.admin === undefined) throw new RTDBError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	protected isAdminApp(app: App | FirebaseApp): app is App {
		if (this.client.admin === undefined) throw new RTDBError("Property 'admin' missing in App class");
		return this.client.admin;
	}

	public async setOnDisconnectQuery<K extends keyof OnDisconnectSignature>(
		method: K,
		path: string,
		...args: OnDisconnectSignature[K]
	) {
		const methodParsed = this.checkOnDisconnectQueryMethod(method);
		const pathParsed = this.checkPath(path, false);
		const [value, priority] = args;

		const databaseRef = this.isAdmin(this._database)
			? this._database.ref().child(pathParsed).onDisconnect()
			: onDisconnect(ref(this._database, pathParsed));

		switch (methodParsed) {
			case "cancel":
			case "remove":
				await databaseRef[methodParsed]();
				break;
			case "set":
				await databaseRef[methodParsed](value);
				break;
			case "update":
				if (value && typeof value === "object") {
					await databaseRef[methodParsed](value);
					break;
				}

				throw new TypeError("The value must be an object with 'update' query.");
			case "setWithPriority":
				await databaseRef[methodParsed](value, this.checkPriority(priority));
				break;
		}
	}
}
