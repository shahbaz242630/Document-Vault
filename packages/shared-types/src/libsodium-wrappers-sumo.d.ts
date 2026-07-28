declare module "libsodium-wrappers-sumo" {
  import type * as sodium from "libsodium-wrappers";

  const sumo: typeof sodium;
  export default sumo;
}
