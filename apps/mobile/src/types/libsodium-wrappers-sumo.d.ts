declare module "libsodium-wrappers-sumo" {
  import type * as sodium from "libsodium-wrappers";
  // libsodium-wrappers-sumo exports everything from the standard build,
  // plus additional functions such as crypto_pwhash. The standard type
  // definitions cover the common surface; we re-export them here so the
  // sumo import is typed.
  export = sodium;
}
