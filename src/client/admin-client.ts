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

import { App } from "firebase-admin/app";
import { nextTick } from "process";
import { TypedEmitter } from "tiny-typed-emitter";
import { ClientError } from "./client-error";
import { AdminConfig, AdminClientEvents, SignState } from "./types";
import { AdminApp } from "../app";

export class AdminClient extends TypedEmitter<AdminClientEvents> {
	private _app!: AdminApp;
	private _appDeleted = false;
	private _appInitialised = false;
	private _signState: SignState = SignState.NOT_YET;

	constructor(protected config: AdminConfig, protected appName?: string) {
		super();
		nextTick(() => this.initClient(config, appName));
	}

	public get admin(): boolean {
		return this._app.admin;
	}

	public get app(): App {
		return this._app.app;
	}

	public get clientDeleted(): boolean {
		return this._appDeleted;
	}

	public get clientInitialised(): boolean {
		return this._appInitialised;
	}

	public get signState(): SignState {
		return this._signState;
	}

	public deleteClient(): Promise<void> {
		if (this._appDeleted === true) throw new ClientError("Client already deleted");

		// TODO: Add sign-out event ?
		this._appDeleted = true;
		this.emit("deleting-client");
		return this._app.deleteApp();
	}

	private initClient(options: AdminConfig, name?: string) {
		let success = false;

		try {
			this._signState = SignState.SIGN_IN;
			this.emit("sign-in");
			this._app = new AdminApp(options, name);
			this._appInitialised = true;
			this._signState = SignState.SIGNED_IN;
			success = true;
		} finally {
			if (!success) this._signState = SignState.ERROR;
			this.emit(success ? "signed-in" : "sign-in-error");
		}
	}
}
