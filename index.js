"use strict";
const geojsonVt = require("geojson-vt");
const vtPbf = require("vt-pbf");
const request = require("requestretry");
const zlib = require("zlib");
const NodeCache = require("node-cache" );
const _ = require("lodash");

const url = process.env.BUS_POSITIONS_URL || "https://raw.githubusercontent.com/stadtnavi/tilelive-bus-positions/main/geojson/bus-positions.geojson";

const getGeoJson = (url, callback) => {
  request(
    {
      url: url,
      maxAttempts: 20,
      retryDelay: 30000,
      retryStrategy: (err, response) =>
        request.RetryStrategies.HTTPOrNetworkError(err, response) ||
        (response && 202 === response.statusCode)
    },
    function(err, res, body) {
      if (err) {
        console.log(`Error when downloading GeoJSON data from ${url}: ${err} ${res} ${body}`);
        callback(err);
        return;
      }
      callback(null, stringifyArrays(JSON.parse(body)));
    }
  );
};

const stringifyArrays = (geoJson) => {
  geoJson.features.forEach( feature => {
    Object.keys(feature.properties).forEach(key => {
      const value = feature.properties[key];
      if(_.isArray(value)) {
        feature.properties[key] = value.join(",");
      }
    });
  });
  return geoJson;
}

class BusSource {
  constructor(uri, callback) {
    this.cacheKey = "tileindex";
    this.cache = new NodeCache({ stdTTL: 15, useClones: false });
    this.url = url;
    callback(null, this);
  }

  fetchGeoJson(callback){
    getGeoJson(this.url, (err, geojson) => {
      if (err) {
        callback(err);
        return;
      }
      callback(geojson);
    });
  }

  getTile(z, x, y, callback) {
    if(this.cache.get(this.cacheKey)) {
      const geojson = this.cache.get(this.cacheKey);
      this.computeTile(geojson, z, x, y, callback);
    } else {
      this.fetchGeoJson((geojson) => {
        this.cache.set(this.cacheKey, geojson);
        this.computeTile(geojson, z, x, y, callback);
      });
    }
  }

  computeTile(geoJson, z, x, y, callback) {
    const tileIndex = geojsonVt(geoJson, { maxZoom: 20, buffer: 512 });
    let tile = tileIndex.getTile(z, x, y);
    if (tile === null) {
      tile = { features: [] };
    }

    const data = Buffer.from(vtPbf.fromGeojsonVt({ buspositions: tile }));

    zlib.gzip(data, function(err, buffer) {
      if (err) {
        callback(err);
        return;
      }

      callback(null, buffer, { "content-encoding": "gzip", "cache-control": "public,max-age=15" });
    });
  }

  getInfo(callback) {
    callback(null, {
      format: "pbf",
      maxzoom: 20,
      vector_layers: [
        {
          description: "Bus position data retrieved from a GeoJSON source",
          id: "buspositions"
        }
      ]
    });
  }
}

module.exports = BusSource;

module.exports.registerProtocols = tilelive => {
  tilelive.protocols["buspositions:"] = BusSource;
};

