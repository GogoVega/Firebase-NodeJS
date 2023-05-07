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
import { AdminClient, Client } from "../client";
import { RTDB } from "../rtdb";
import { ConnectionStatus } from "../types/connection/connection";

export class Connection {
	private _state: ConnectionStatus = ConnectionStatus.disconnected;
	private firstConnectionEtablished = false;
	private subscriptionCallback?: Unsubscribe;
	private timeoutID: ReturnType<typeof setTimeout> | undefined;

	constructor(protected database: RTDB) {
		const client = this.database.client;

		nextTick(this.subscribeConnectionState.bind(this));

		if (client instanceof Client) {
			client.on("sign-in", this.subscribeConnectionState.bind(this));
			client.on("sign-out", this.removeConnectionState.bind(this));
		} else if (client instanceof AdminClient) {
			client.once("deleting-client", this.removeConnectionState.bind(this));
		} else {
			client.once("deleting-client", this.removeConnectionState.bind(this));
		}
	}

	public get state() {
		return this._state;
	}

	private subscribeConnectionState() {
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
				} else {
					// Based on maximum time for Firebase admin
					this.timeoutID = setTimeout(() => this.database.emit("disconnected"), 30000);
					this._state = this.firstConnectionEtablished
						? ConnectionStatus["re-connecting"]
						: ConnectionStatus.connecting;

					if (this.firstConnectionEtablished === true) this.database.emit("disconnect");
					this.firstConnectionEtablished ? this.database.emit("re-connecting") : this.database.emit("connecting");
				}
			},
			(error) => {
				throw error;
			}
		);
	}

	private removeConnectionState() {
		if (this.subscriptionCallback) this.subscriptionCallback();

		this.subscriptionCallback = undefined;
	}
}
