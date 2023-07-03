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

import { cert } from "firebase-admin/app";
import { TypedEmitter } from "tiny-typed-emitter";
import { AdminClient } from "./admin-client";
import { BaseClient } from "./base-client";
import { ClientError } from "./client-error";
import { checkJSONCredential } from "./utils";
import { AppConfig, ClientEvents, Credentials, SignState } from "../types/client/client";

export class Client extends TypedEmitter<ClientEvents> {
	private client?: AdminClient | BaseClient;

	constructor(protected config: AppConfig, protected appName?: string) {
		super();
	}

	public get admin() {
		return this.client?.admin;
	}

	public get app() {
		return this.client?.app;
	}

	public get clientDeleted() {
		return this.client?.clientDeleted;
	}

	public get clientInitialised() {
		return this.client?.clientInitialised;
	}

	public get signState() {
		return this.client?.signState || SignState.NOT_YET;
	}

	private attachListeners() {
		if (this.client instanceof AdminClient) {
			this.client
				.on("deleting-client", () => this.emit("deleting-client"))
				.on("sign-in", () => this.emit("sign-in"))
				.on("signed-in", () => this.emit("signed-in"))
				.on("sign-in-error", () => this.emit("sign-in-error"));
		} else if (this.client instanceof BaseClient) {
			this.client
				.on("deleting-client", () => this.emit("deleting-client"))
				.on("sign-in", () => this.emit("sign-in"))
				.on("sign-out", () => this.emit("sign-out"))
				.on("signed-in", () => this.emit("signed-in"))
				.on("sign-in-error", () => this.emit("sign-in-error"))
				.on("warn", (msg) => this.emit("warn", msg));
		}
	}

	public signInAnonymously() {
		if (this.signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");

		this.client = new BaseClient(this.config, this.appName);
		this.attachListeners();
		return this.client.signInAnonymously();
	}

	public signInWithCustomToken(cred: Credentials, uid: string, claims?: object) {
		if (this.signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");

		this.client = new BaseClient(this.config, this.appName);
		this.attachListeners();
		return this.client.signInWithCustomToken(cred, uid, claims);
	}

	public signInWithEmailAndPassword(email: string, password: string, createUser?: boolean) {
		if (this.signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");

		this.client = new BaseClient(this.config, this.appName);
		this.attachListeners();
		return this.client.signInWithEmailAndPassword(email, password, createUser);
	}

	public signInWithPrivateKey(projectId: string, clientEmail: string, privateKey: string) {
		if (this.signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");

		const credential = { credential: cert(checkJSONCredential({ clientEmail, privateKey, projectId })) };
		this.client = new AdminClient({ ...this.config, ...credential }, this.appName);
		this.attachListeners();
	}

	/**
	 * Only available for Google Functions, this shit
	 * https://github.com/firebase/firebase-admin-node/issues/224
	 * @param serviceAccountId
	 */
	public signInWithServiceAccountId(serviceAccountId: string) {
		if (this.signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");

		this.client = new AdminClient({ ...this.config, serviceAccountId }, this.appName);
		this.attachListeners();
	}

	public async signOut() {
		if (this.signState === SignState.NOT_YET) throw new ClientError("signOut called before signIn call");
		if (this.signState === SignState.SIGN_OUT) throw new ClientError("signOut already called");
		if (!this.client) throw new ClientError("Client to delete missing");

		if (!this.admin) await (this.client as BaseClient).signOut();

		return this.client.deleteClient();
	}
}
