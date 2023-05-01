# Firebase-NodeJS

JavaScript library for Node.js to communicate with Google Firebase.

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
  .on("signed-in", (success) => console.log("Signed In:", success))
  .signInAnonymously();

const rtdb = new RTDB(client)
  .on("connecting", () => console.log("Connecting..."))
  .on("connected", () => console.log("Connected"))
  .on("disconnect", () => console.log("Disconnect"))
  .doGetQuery("users")
  .then((snapshot) => console.log(snapshot.val()));
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
