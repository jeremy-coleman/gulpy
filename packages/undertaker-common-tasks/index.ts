import * as fs from "fs-extra"
import * as logger from "gulplog"
import { DefaultRegistry } from "undertaker-registry"
import type { Undertaker } from "undertaker"

interface CommonRegistryOptions {
  buildDir: string
}

export class CommonRegistry extends DefaultRegistry {
  config: CommonRegistryOptions

  constructor({ buildDir = "./build" } = {}) {
    super()
    this.config = { buildDir }
  }

  init(taker: Undertaker) {
    const buildDir = this.config.buildDir
    const exists = fs.existsSync(buildDir)

    if (exists) {
      throw Error(
        "Cannot initialize undertaker-common-tasks registry. `build/` directory exists."
      )
    }

    taker.task("clean", () => fs.removeSync(buildDir))

    taker.task("serve", cb => {
      logger.info("Served!")
      cb()
    })
  }
}
