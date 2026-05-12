import { describe, expect, test } from "vitest";
import { assertPublicHttpUrl, parsePublicHttpUrl } from "../../api/_url.js";

describe("safe URL helper", () => {
  test("allows http and https URLs", () => {
    expect(parsePublicHttpUrl("https://example.com/path").href).toBe("https://example.com/path");
    expect(parsePublicHttpUrl("http://example.com/").href).toBe("http://example.com/");
  });

  test("rejects unsupported protocols", () => {
    expect(() => parsePublicHttpUrl("file:///etc/passwd")).toThrow("http or https");
  });

  test("rejects loopback and private literal hosts", async () => {
    await expect(assertPublicHttpUrl("http://127.0.0.1:3002")).rejects.toMatchObject({
      status: 400,
      code: "blocked_url_host",
    });
    await expect(assertPublicHttpUrl("http://10.0.0.5")).rejects.toMatchObject({
      status: 400,
      code: "blocked_url_host",
    });
  });
});
