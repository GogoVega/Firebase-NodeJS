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

import { nextTick } from "process";
import { TypedEmitter } from "tiny-typed-emitter";
import { ClientError } from "./client-error";
import { AdminApp } from "../app";
import { AppConfig, AdminClientEvents, SignState } from "../types/client/admin-client";

export class AdminClient extends TypedEmitter<AdminClientEvents> {
	private _app!: AdminApp;
	private _appDeleted = false;
	private _appInitialised = false;
	private _signState: SignState = SignState.NOT_YET;

	constructor(protected config: AppConfig, protected appName?: string) {
		super();
		nextTick(() => this.initClient(config, appName));
	}

	public get admin() {
		return this._app.admin;
	}

	public get app() {
		return this._app.app;
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

		// TODO: Add sign-out event ?
		this._appDeleted = true;
		this.emit("deleting-client");
		return this._app.deleteApp();
	}

	private initClient(options: AppConfig, name?: string) {
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
