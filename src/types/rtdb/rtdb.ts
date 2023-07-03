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

import { Unsubscribe } from "firebase/database";
import { DataSnapshot as AdminDataSnapshot, Query, Reference } from "firebase-admin/database";

export interface RTDBEvents {
	connected: () => void;
	connecting: () => void;
	disconnect: () => void;
	disconnected: () => void;
	"re-connecting": () => void;
	log: (msg: string) => void;
}

export enum ListenerMap {
	value = "onValue",
	child_added = "onChildAdded",
	child_changed = "onChildChanged",
	child_moved = "onChildMoved",
	child_removed = "onChildRemoved",
}

export type Listener = keyof typeof ListenerMap;

export enum QueryMethodMap {
	"set",
	"push",
	"update",
	"remove",
	"setPriority",
	"setWithPriority",
}

export type QueryMethod = keyof typeof QueryMethodMap;

export interface QuerySignature {
	set: [value: unknown];
	push: [value: unknown];
	update: [value: object];
	remove: [value?: null];
	setPriority: [priority: string | number | null];
	setWithPriority: [value: unknown, priority: string | number | null];
}

export enum OnDisconnectMethodMap {
	"cancel",
	"set",
	"update",
	"remove",
	"setWithPriority",
}

export interface OnDisconnectSignature {
	cancel: [];
	set: [value: unknown];
	update: [value: object];
	remove: [];
	setWithPriority: [value: unknown, priority: string | number | null];
}

export type OnDisconnectMethod = keyof typeof OnDisconnectMethodMap;

export type ValueField = number | string | boolean | null;

export interface RangeQuery {
	key?: string;
	value: ValueField;
}

export interface QueryConstraintType {
	orderByKey?: null;
	orderByPriority?: null;
	orderByValue?: null;
	limitToFirst?: number;
	limitToLast?: number;
	orderByChild?: string;
	endAt?: RangeQuery;
	endBefore?: RangeQuery;
	equalTo?: RangeQuery;
	startAfter?: RangeQuery;
	startAt?: RangeQuery;
}

export type DBRef = Reference | Query;

export type Unsubscription = Unsubscribe | ((a: AdminDataSnapshot | null, b?: string | null) => void);
