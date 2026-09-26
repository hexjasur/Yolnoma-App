import { describe, expect, it } from "vitest";
import { imageUrlFromText } from "./imageAttachments";

describe("imageUrlFromText", () => {
  it("accepts direct image URLs with query strings", () => {
    expect(
      imageUrlFromText("https://images.example/photo.webp?size=large"),
    ).toBe("https://images.example/photo.webp?size=large");
  });

  it("extracts an image URL copied from Google Images", () => {
    expect(
      imageUrlFromText(
        "https://www.google.com/imgres?imgurl=https%3A%2F%2Fimages.example%2Fcat.jpg",
      ),
    ).toBe("https://images.example/cat.jpg");
  });

  it("does not treat ordinary page URLs as image attachments", () => {
    expect(imageUrlFromText("https://example.com/article")).toBeNull();
  });
});
