# aircraft-loader
An extension for GeoFS that will be able to load aircraft from a remote URL

# Formata for external aircraft serving (See the LWASP implementation on our GitHub.)
Given is an identifier for the plane, starting with "AC:" followed by the url of the plane encoded in Base64.
	For example: the url is http://presentit.co.il/yotamsalmon/cesium/load.php?id=319
	The identifier will be AC:aHR0cDovL3ByZXNlbnRpdC5jby5pbC95b3RhbXNhbG1vbi9jZXNpdW0vbG9hZC5waHA/aWQ9MzE5

```
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
```
