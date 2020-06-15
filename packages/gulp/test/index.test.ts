import { expect } from "chai"
import gulp from "../index"

describe("gulp", () => {
  describe("hasOwnProperty", () => {
    it("src", () => {
      expect(gulp.hasOwnProperty("src")).to.be.true
    })

    it("dest", () => {
      expect(gulp.hasOwnProperty("dest")).to.be.true
    })

    it("symlink", () => {
      expect(gulp.hasOwnProperty("symlink")).to.be.true
    })

    it("watch", () => {
      expect(gulp.hasOwnProperty("watch")).to.be.true
    })

    it("task", () => {
      expect(gulp.hasOwnProperty("task")).to.be.true
    })

    it("series", () => {
      expect(gulp.hasOwnProperty("series")).to.be.true
    })

    it("parallel", () => {
      expect(gulp.hasOwnProperty("parallel")).to.be.true
    })

    it("tree", () => {
      expect(gulp.hasOwnProperty("tree")).to.be.true
    })

    it("lastRun", () => {
      expect(gulp.hasOwnProperty("lastRun")).to.be.true
    })

    it("registry", () => {
      expect(gulp.hasOwnProperty("registry")).to.be.true
    })
  })
})
