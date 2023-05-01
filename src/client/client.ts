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
import { cert, ServiceAccount } from "firebase-admin/app";
import { Auth as AdminAuth, getAuth as adminGetAuth } from "firebase-admin/auth";
import { TypedEmitter } from "tiny-typed-emitter";
import { ClientError } from "./client-error";
import { AdminApp, App } from "../app";
import { claimsNotAllowed } from "../const/client";
import { AppConfig, ClientEvents, Credentials, ServiceAccountId, SignInFn, SignState } from "../types/client/client";

export class Client extends TypedEmitter<ClientEvents> {
	private _app?: AdminApp | App;
	private _appInitialised = false;
	private _auth?: AdminAuth | Auth;
	private _signState: SignState = SignState.NOT_YET;

	constructor(protected config: AppConfig, protected appName?: string) {
		super();
	}

	public get app() {
		return this._app?.app;
	}

	public get appInitialised() {
		return this._appInitialised;
	}

	public get isAdmin() {
		return this._app?.admin;
	}

	public get signState() {
		return this._signState;
	}

	/**
	 * Check if the received JSON content credentials contain the desired elements.
	 * @param content The JSON content credentials
	 * @returns The JSON content credentials checked
	 */
	protected checkJSONCredential(content: unknown) {
		if (!content || typeof content !== "object" || !Object.keys(content).length)
			throw new Error("JSON Content must contain 'projectId', 'clientEmail' and 'privateKey'");

		for (const key of ["clientEmail", "privateKey", "projectId"]) {
			if (!content[key as keyof typeof content]) throw new Error(`JSON Content must contain '${key}'`);
		}

		return content as ServiceAccount;
	}

	protected async createCustomToken(cred: Credentials, uid: string, claims?: object) {
		if (claims && typeof claims !== "object") throw new Error();

		Object.keys(claims || {}).forEach((key) => {
			if (claimsNotAllowed.includes(key)) throw new Error(`Claim key '${key}' is not allowed`);
		});

		const auth = this.initSignIn(true, cred);
		const token = auth.createCustomToken(uid, claims);
		await this._app?.deleteApp();
		return token;
	}

	public deleteApp() {
		if (!this._app) throw new ClientError("deleteApp called before Sign in call");
		this._appInitialised = false;
		return this._app.deleteApp();
	}

	protected initSignIn(admin: true, cred: Credentials): AdminAuth;
	protected initSignIn(admin?: false): Auth;
	protected initSignIn(admin?: boolean, cred?: Credentials) {
		const credential = cred
			? "serviceAccountId" in cred
				? (cred as ServiceAccountId)
				: { credential: cert(this.checkJSONCredential(cred)) }
			: {};
		const options = admin ? { ...this.config, ...credential } : this.config;

		this._app = admin ? new AdminApp(options, this.appName) : new App(options, this.appName);
		this._appInitialised = true;
		this.emit("sign-in");
		this._auth = this._app instanceof AdminApp ? adminGetAuth(this._app.app) : getAuth(this._app.app);
		return this._auth;
	}

	public signInAnonymously() {
		return this.wrapSignIn(() => {
			const auth = this.initSignIn();
			return signInAnonymously(auth);
		});
	}

	public signInWithCustomToken(cred: Credentials, uid: string, claims?: object) {
		return this.wrapSignIn(async () => {
			const token = await this.createCustomToken(cred, uid, claims);
			const auth = this.initSignIn();
			return signInWithCustomToken(auth, token);
		});
	}

	public async signInWithEmailAndPassword(email: string, password: string, createUser?: boolean) {
		return this.wrapSignIn(async () => {
			const auth = this.initSignIn();
			// Checks if the user already has an account otherwise it creates one
			const method = await fetchSignInMethodsForEmail(auth, email);

			if (method.length === 0 && createUser) {
				return createUserWithEmailAndPassword(auth, email, password);

				// warn(`The user "${email}" has been successfully created. You can delete it in the Authenticate section if it is an error.`);
			} else if (method.includes("password")) {
				return signInWithEmailAndPassword(auth, email, password);
				// TODO: to see... else if (method.includes("link")) {}
			} else {
				throw new ClientError("auth/unknown-email");
			}
		});
	}

	public signInWithPrivateKey(projectId: string, clientEmail: string, privateKey: string) {
		let success = false;

		try {
			this.initSignIn(true, { clientEmail, privateKey, projectId });
			this._signState = SignState.SIGNED_IN;
			success = true;
		} finally {
			if (!success) this._signState = SignState.ERROR;
			this.emit("signed-in", success);
		}
	}

	public signInWithServiceAccountId(projectId: string, serviceAccountId: string) {
		let success = false;

		try {
			this.initSignIn(true, { projectId, serviceAccountId });
			this._signState = SignState.SIGNED_IN;
			success = true;
		} finally {
			if (!success) this._signState = SignState.ERROR;
			this.emit("signed-in", success);
		}
	}

	public signOut() {
		if (!this._auth) throw new ClientError("signOut called before signIn call");
		this._signState = SignState.SIGNED_OUT;
		this.emit("sign-out");
		return this._auth instanceof AdminAuth ? Promise.resolve() : signOut(this._auth);
	}

	protected async wrapSignIn(signInFn: SignInFn) {
		let success = false;

		try {
			const user = await signInFn();
			this._signState = SignState.SIGNED_IN;
			success = true;
			return user;
		} finally {
			if (!success) this._signState = SignState.ERROR;
			this.emit("signed-in", success);
		}
	}
}
