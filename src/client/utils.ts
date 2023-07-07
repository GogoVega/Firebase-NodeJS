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
import { ServiceAccount, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { claimsNotAllowed } from "./constants";
import { Credentials, ServiceAccountId } from "./types";
import { AdminApp } from "../app";

/**
 * Check if the received JSON content credentials contain the desired elements.
 * @param content The JSON content credentials
 * @returns The JSON content credentials checked
 */
function checkJSONCredential(content: unknown): ServiceAccount {
	if (!content || typeof content !== "object" || !Object.keys(content).length)
		throw new TypeError("JSON Object must contain 'projectId', 'clientEmail' and 'privateKey'");

	for (const key of ["clientEmail", "privateKey", "projectId"]) {
		if (!content[key as keyof typeof content]) throw new TypeError(`JSON Content must contain '${key}'`);
	}

	return content;
}

async function createCustomToken(cred: Credentials, uid: string, claims?: object): Promise<string> {
	if (claims && typeof claims !== "object") throw new TypeError("Claims type must be an object");

	Object.keys(claims || {}).forEach((key) => {
		if (claimsNotAllowed.includes(key)) throw new Error(`Claim key '${key}' is not allowed`);
	});

	const credential = cred
		? "serviceAccountId" in cred
			? (cred as ServiceAccountId)
			: { credential: cert(checkJSONCredential(cred)) }
		: {};

	const app = new AdminApp(credential, "token-generation");
	const token = getAuth(app.app).createCustomToken(uid, claims);
	await app.deleteApp();
	return token;
}

function isFirebaseError(error: unknown): error is FirebaseError {
	return (
		error instanceof FirebaseError ||
		(Object.prototype.hasOwnProperty.call(error, "code") &&
			typeof error === "object" &&
			error !== null &&
			"name" in error &&
			error.name === "FirebaseError")
	);
}

export { checkJSONCredential, createCustomToken, isFirebaseError };
