/*

# Formata for external aircraft serving (See the LWASP implementation on our GitHub.)
Given is an identifier for the plane, starting with "AC:" followed by the url of the plane encoded in Base64.
	For example: the url is http://presentit.co.il/yotamsalmon/cesium/load.php?id=319
	The identifier will be AC:aHR0cDovL3ByZXNlbnRpdC5jby5pbC95b3RhbXNhbG1vbi9jZXNpdW0vbG9hZC5waHA/aWQ9MzE5

The server serves the aircraft descriptor in JSON format like that:
{
	"id": 319, // The ID of the plane on the server. Should be above 300.
	"name": "Lufthansa CityLine CRJ-900", // The name of the plane
	"fullPath": "http://presentit.co.il/yotamsalmon/cesium/file.php?name=319/", // The path to load files from. Thus combined with the file name should serve the specific file.
																			    // http://presentit.co.il/yotamsalmon/cesium/file.php?name=319/multiplayer.glb should return the mp model.
																				// Mind the slash in the end. It's important if you use directory-file organization model on your server.
																			   
	"isPremium": 0, // Just return 0
	"isCommunity": 0, // Don't do community aircraft.
	"definition": "..." // The aircraft definition JSON according to the GeoFS specification, encoded in Base64.
					    // For examples, see the King Solomon Air Q400 implementation on our GitHub.
}
*/

geofs.aircraft.Aircraft.prototype.load = function(a, b, c) {
	var isExternal = !a.toString().indexOf("AC:"); // This line determines if the aircraft we are loading is external (external aircraft IDs will start with AC: when loading)
    $.ajax(isExternal ? atob(a.substring(3)) : "/models/aircraft/load.php", { // Externals will be encoded in base64 url like AC:<url in b64>
        data: (isExternal ? {} : {
            id: a
        }),
        dataType: "text",
        success: function(d, e, f) {
            if ("error" != e) {
                if (d = geofs.aircraft.instance.parseRecord(d))
                    geofs.aircraft.instance.id = a,
                    geofs.aircraft.instance.init(d, b, c);
            } else
                geofs.aircraft.instance.loadDefault("Could not load aircraft file")
        },
        error: function(b, c, f) {
            a != geofs.aircraft["default"] && geofs.aircraft.instance.loadDefault("Could not load aircraft file" + f)
        }
    })
}
;

geofs.aircraft.Aircraft.prototype.change = function(a, b) {
    a = a || this.aircraftRecord.id;
    geofs.doPause(!0);
    this.load(a, this.getCurrentCoordinates(), b);
    geofs.api.analytics.event("aircraft", (geofs.aircraftList[a] || {name: "External Aircraft"}).name) // For google analytics, Xavier, we'll just inform you that we're loading an "External Aircraft" (because we still don't know anything about it - just the URL)
};

geofs.aircraft.Aircraft.prototype.parseRecord = function(a) {
    try {
        var b = $.parseJSON(a);
        this.aircraftRecord = b;
        if (b.definition) {
            var c = atob(b.definition);
            var d = eval(c)[0] // That line was modified. JSON will be evaluated, not parsed, for more creativity. 
							   // "Security," they said.
        }
        if (b.error) {
            this.loadDefault(b.error);
            return
        }
    } catch (e) {
        this.loadDefault("Incorrect aircraft definition file: " + e.message);
        return
    }
    return d
};

multiplayer.sendUpdate = function() {
	var isExternal = geofs.aircraft.instance.aircraftRecord["altId"];
    try {
        if (!multiplayer.lastRequest && !flight.recorder.playing) {
            var a = geofs.aircraft.instance
              , b = Date.now();
            multiplayer.lastRequestTime = b;
            var c = $.merge($.merge([], a.llaLocation), a.htr);
            if (c.join() != multiplayer.lastJoinedCoordinates) {
                multiplayer.lastJoinedCoordinates = c.join();
                var d = V3.scale(xyz2lla(a.rigidBody.getLinearVelocity(), a.llaLocation), .001)
                  , e = $.merge(d, a.htrAngularSpeed)
                  , f = {
                    acid: geofs.userRecord.id,
                    sid: geofs.userRecord.sessionId,
                    id: multiplayer.myId,
                    ac: isExternal ? a.aircraftRecord.altId : a.aircraftRecord.id, // If the aircraft is external, we'll send the alternative aircraft on the "ac" property so no phantom aircraft are created
                    co: c,
                    ve: e,
                    st: { // All the rest are validated. The "st" property is a free to sync object, so we can send info over this channel.
                        gr: a.groundContact,
						rac: isExternal ? btoa(a.aircraftRecord.fullPath) : null // And we'll use the "rac" property for determining the URL of the aircraft. This will be the base path that was returned from the server.
                    },
                    ti: multiplayer.getServerTime(),
                    m: multiplayer.chatMessage,
                    ci: multiplayer.chatMessageId,
                    v: 115
                };
                multiplayer.chatMessage = "";
                multiplayer.lastRequest = geofs.ajax.post(geofs.multiplayerHost + "/update", f, multiplayer.updateCallback, multiplayer.errorCallback)
            }
        }
    } catch (g) {
        geofs.debug.error(g, "multiplayer.sendUpdate")
    }
};

multiplayer.User.prototype.updateModel= function(a) {
	var b = this.getLOD(a);
	(!this.models || 0 == this.models.length) && 0 < b && b < multiplayer.numberOfLOD && (this.models = multiplayer.loadModels(a)); // Instead of giving the loadModels just the aircraft id, we'll give the player object so it can determine what kind of aircraft it is.
	if (b != this.lod) {
		this.removeModel();
		var c = b - 1;
		this.models.length > c && 0 <= c ? (this.model = this.models[c],
		geofs.api.addModelToWorld(this.model),
		multiplayer.visibleUsers[this.id] = this) : b == multiplayer.numberOfLOD && (multiplayer.visibleUsers[this.id] = this);
		this.lod = b
	}
	if (this.premium != a.p || this.callsign != a.cs)
		this.premium = a.p,
		this.callsign = a.cs,
		this.removeCallsign();
	this.label || (a = a.p ? "premium" : "default",
	a = this.isTraffic ? "traffic" : a,
	this.addCallsign(this.callsign, a))
};

multiplayer.loadModels = function(p) {
	var isExternal = p.st["rac"]; // Are we using an external aircraft?
	var a = p.ac;
    var b = [];
    if (geofs.aircraftList[a]) {
        var c = isExternal ? (atob(p.st["rac"]) + "multiplayer.glb") : (PAGE_PATH + geofs.aircraftList[a].path + "/multiplayer.glb"); // Determining where to take the stuff from
        a = isExternal ? (atob(p.st["rac"]) + "multiplayer-low.glb") : (PAGE_PATH + geofs.aircraftList[a].path + "/multiplayer-low.glb"); // Also for low res model.
        b.push(geofs.loadModel(c, {
            justLoad: !0
        }));
        b.push(geofs.loadModel(a, {
            justLoad: !0
        }))
    }
    return b
};

(function() {
	var featured = "<li class='geofs-list-collapsible-item'>Aircraft Warehouse<ul>";
	$.ajax({
	   url: "http://aircraft-loader.appspot.com/featured.php",
		type: "GET",
		success: function(e) {
			var j = JSON.parse(e);
			for (var i = 0; i < j.length; i++) {
				featured += "<li data-aircraft='AC:" + btoa(j[i].url) + "'>" + j[i].name + "</li>";
			}
			featured += "</ul></li>";
			$(".geofs-aircraft-list").prepend(featured);
		}
	});
})();