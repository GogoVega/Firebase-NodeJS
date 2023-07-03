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

import { Database, onValue, ref, Unsubscribe } from "firebase/database";
import { nextTick } from "process";
import { RTDB } from "../rtdb";
import { ConnectionStatus } from "../types/connection/connection";

export class Connection {
	private _state: ConnectionStatus = ConnectionStatus.disconnected;
	private firstConnectionEtablished = false;
	private subscriptionCallback?: Unsubscribe;
	private timeoutID: ReturnType<typeof setTimeout> | undefined;

	constructor(protected database: RTDB) {
		nextTick(() => this.subscribeConnectionState());
	}

	public get state() {
		return this._state;
	}

	private subscribeConnectionState() {
		const databaseURL = this.database.database.app.options.databaseURL;
		this.subscriptionCallback = onValue(
			ref(this.database.database as Database, ".info/connected"),
			(snapshot) => {
				if (snapshot.val() === true) {
					if (this.timeoutID) {
						clearTimeout(this.timeoutID);
						this.timeoutID = undefined;
					}
					this._state = ConnectionStatus.connected;
					this.firstConnectionEtablished = true;
					this.database.emit("connected");
					this.database.emit("log", `Connected to Firebase RTDB: ${databaseURL}`);
				} else {
					// Based on maximum time for Firebase admin
					this.timeoutID = setTimeout(() => {
						this._state = ConnectionStatus.disconnected;
						this.database.emit("disconnected");
					}, 30000);

					this._state = this.firstConnectionEtablished ? ConnectionStatus.re_connecting : ConnectionStatus.connecting;

					if (this.firstConnectionEtablished === true) this.database.emit("disconnect");
					this.firstConnectionEtablished ? this.database.emit("re-connecting") : this.database.emit("connecting");
					this.database.emit(
						"log",
						`${this.firstConnectionEtablished ? "Re-" : ""}Connecting to Firebase RTDB: ${databaseURL}`
					);
				}
			},
			(error) => {
				throw error;
			}
		);
	}

	// TODO: détacher l'écouteur ?
	public removeConnectionState() {
		if (this.subscriptionCallback) this.subscriptionCallback();

		this.subscriptionCallback = undefined;
	}
}
