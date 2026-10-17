import { describe, it, expect } from "vitest";
import { emailProblem } from "../src/shared/email";

describe("emailProblem", () => {
  it("accepts real addresses", () => {
    for (const e of ["jessicap123k@gmail.com", " Seema@Gmail.com ", "a.b+c@yahoo.co.in", "x@mail.com", "me@agrolloo.com"]) {
      expect(emailProblem(e)).toBeNull();
    }
  });
  it("catches provider typos", () => {
    for (const e of ["akshatpatidat17@gamail.com", "a@gmial.com", "a@gmail.con", "a@gmai.com", "a@yahooo.com", "a@hotmial.com"]) {
      expect(emailProblem(e)).toMatch(/did you mean/);
    }
  });
  it("catches malformed addresses", () => {
    for (const e of ["", "abc", "a@b", "a @gmail.com", "a@@gmail.com", "a@gmail"]) {
      expect(emailProblem(e)).toMatch(/doesn't look like/);
    }
  });
});
