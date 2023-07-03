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

import { FirebaseOptions } from "firebase/app";
import { UserCredential } from "firebase/auth";

export type AppConfig = FirebaseOptions;

export interface BaseClientEvents {
	"deleting-client": () => void;
	"sign-in": () => void;
	"sign-out": () => void;
	"signed-in": () => void;
	"sign-in-error": () => void;
	warn: (msg: string) => void;
}

export interface ServiceAccount {
	clientEmail: string;
	privateKey: string;
	projectId: string;
	serviceAccountId?: never;
}

export interface ServiceAccountId {
	clientEmail?: never;
	privateKey?: never;
	projectId?: never;
	serviceAccountId: string;
}

export type Credentials = ServiceAccount | ServiceAccountId;

export enum SignState {
	"NOT_YET",
	"SIGN_IN",
	"SIGN_OUT",
	"SIGNED_IN",
	"ERROR",
}

export type SignInFn = () => Promise<UserCredential>;
