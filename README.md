# Firebase-NodeJS

Node.js library to communicate with Google Firebase.

**WARNING**: work in progress!!!

## Usage Example

```js
const firebaseConfig = {
  databaseURL: "...",
  apiKey: "AIza...",
};

const client = new Client(firebaseConfig);
client
  .on("sign-in", () => console.log("Sign In..."))
  .on("sign-out", () => console.log("Sign Out..."))
  .on("signed-in", () => console.log("Signed In"))
  .signInAnonymously();

const rtdb = new RTDB(client)
  .on("connecting", () => console.log("Connecting..."))
  .on("disconnect", () => console.log("Disconnect"))
  .on("connected", () => {
    console.log("Connected");

    // Fetches data from "users" path
    rtdb.doGetQuery("users").then((snapshot) => console.log(snapshot.val()));

    // Set data at the target "users" path
    rtdb.doWriteQuery("set", "users", { id: "alanIsAwesome" });

    // Subscribes to data at "users" path, which yields a payload whenever a value changes.
    rtdb.doSubscriptionQuery("value", (snapshot) => console.log(snapshot.val()), "users");
  });
```

## TODO List

- [ ] Other Authentication Methods
- [ ] Documentation
- [ ] Firestore Database
- [ ] Logger
- [ ] ...

## License

Copyright 2023 Gauthier Dandele

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
