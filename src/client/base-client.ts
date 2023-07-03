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

import { FirebaseError } from "firebase/app";
import {
	Auth,
	createUserWithEmailAndPassword,
	fetchSignInMethodsForEmail,
	getAuth,
	signInAnonymously,
	signInWithCustomToken,
	signInWithEmailAndPassword,
	signOut,
} from "firebase/auth";
import { TypedEmitter } from "tiny-typed-emitter";
import { ClientError } from "./client-error";
import { createCustomToken } from "./utils";
import { App } from "../app";
import { AppConfig, BaseClientEvents, Credentials, SignInFn, SignState } from "../types/client/base-client";

export class BaseClient extends TypedEmitter<BaseClientEvents> {
	private _app: App;
	private _appDeleted = false;
	private _appInitialised = false;
	private _auth: Auth;
	private _signState: SignState = SignState.NOT_YET;

	constructor(config: AppConfig, appName?: string) {
		super();
		this._app = new App(config, appName);
		this._appInitialised = true;
		this._auth = getAuth(this._app.app);
	}

	public get admin() {
		return this._app?.admin;
	}

	public get app() {
		return this._app?.app;
	}

	public get clientDeleted() {
		return this._appDeleted;
	}

	public get clientInitialised() {
		return this._appInitialised;
	}

	public get signState() {
		return this._signState;
	}

	public deleteClient() {
		if (this._appDeleted === true) throw new ClientError("Client already deleted");

		this._appDeleted = true;
		this.emit("deleting-client");
		return this._app.deleteApp();
	}

	public signInAnonymously() {
		return this.wrapSignIn(() => signInAnonymously(this._auth));
	}

	public signInWithCustomToken(cred: Credentials, uid: string, claims?: object) {
		return this.wrapSignIn(async () => {
			const token = await createCustomToken(cred, uid, claims);
			return signInWithCustomToken(this._auth, token);
		});
	}

	public async signInWithEmailAndPassword(email: string, password: string, createUser?: boolean) {
		return this.wrapSignIn(async () => {
			// Checks if the user already has an account otherwise it creates one
			const method = await fetchSignInMethodsForEmail(this._auth, email);

			if (method.length === 0 && createUser) {
				const user = await createUserWithEmailAndPassword(this._auth, email, password);

				this.emit(
					"warn",
					`The user "${email}" has been successfully created. You can delete it in the Authenticate section if it is an error.`
				);
				return user;
			} else if (method.includes("password")) {
				return signInWithEmailAndPassword(this._auth, email, password);
			} else {
				throw new FirebaseError("auth/unknown-email", "Unknown email");
			}
		});
	}

	public signOut() {
		if (this._signState === SignState.NOT_YET) throw new ClientError("signOut called before signIn call");
		if (this._signState === SignState.SIGN_OUT) throw new ClientError("signOut already called");
		if (this._appDeleted === true) throw new ClientError("Client deleted");

		this._signState = SignState.SIGN_OUT;
		this.emit("sign-out");
		return signOut(this._auth);
	}

	protected async wrapSignIn(signInFn: SignInFn) {
		let success = false;

		if (this._signState === SignState.SIGNED_IN) throw new ClientError("Client already Signed in, Sign out before");
		if (this._appDeleted === true) throw new ClientError("Client deleted");

		try {
			this.emit("sign-in");
			const user = await signInFn();
			this._signState = SignState.SIGNED_IN;
			success = true;
			return user;
		} finally {
			if (!success) this._signState = SignState.ERROR;
			this.emit(success ? "signed-in" : "sign-in-error");
		}
	}
}
