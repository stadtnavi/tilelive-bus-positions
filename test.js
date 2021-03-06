const fs = require("fs");
const assert = require("assert");
const BusSource = require("./index");

describe("BusSource", function() {

  it("fetch data", (done) => {
    const source = new BusSource(null, () => {});
    assert.ok(source);

    // request tile in Herrenberg
    source.getTile(17, 68763, 45237, (err, response) => {
      assert.ok(response.length > 100);
      assert.ok(response);

      // request another tile
      // should come from the cache
      source.getTile(17, 68763, 45237, (err, response) => {
        assert.ok(response.length > 100);
        assert.ok(response);
        assert.ok(source.cache.has(source.cacheKey));
        done();
      })

    })
  });
});
