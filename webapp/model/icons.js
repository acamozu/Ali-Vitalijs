sap.ui.define([], function () {
	"use strict";

	/* Static SVG markup of the carpool page. Every function returns the string React renders for the
	   same element in the original page (lucide-react 1.69.0), so the CSS applies unchanged. */

	// lucide icons: component name -> [icon class names, child elements]
	var ICONS = {
		"ArrowDown": ["lucide-arrow-down", "<path d=\"M12 5v14\"></path><path d=\"m19 12-7 7-7-7\"></path>"],
		"ArrowRight": ["lucide-arrow-right", "<path d=\"M5 12h14\"></path><path d=\"m12 5 7 7-7 7\"></path>"],
		"ArrowUp": ["lucide-arrow-up", "<path d=\"m5 12 7-7 7 7\"></path><path d=\"M12 19V5\"></path>"],
		"Bell": ["lucide-bell", "<path d=\"M10.268 21a2 2 0 0 0 3.464 0\"></path><path d=\"M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326\"></path>"],
		"Car": ["lucide-car", "<path d=\"M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2\"></path><circle cx=\"7\" cy=\"17\" r=\"2\"></circle><path d=\"M9 17h6\"></path><circle cx=\"17\" cy=\"17\" r=\"2\"></circle>"],
		"CarTaxiFront": ["lucide-car-taxi-front", "<path d=\"M10 2h4\"></path><path d=\"m21 8-2 2-1.5-3.7A2 2 0 0 0 15.646 5H8.4a2 2 0 0 0-1.903 1.257L5 10 3 8\"></path><path d=\"M7 14h.01\"></path><path d=\"M17 14h.01\"></path><rect width=\"18\" height=\"8\" x=\"3\" y=\"10\" rx=\"2\"></rect><path d=\"M5 18v2\"></path><path d=\"M19 18v2\"></path>"],
		"Check": ["lucide-check", "<path d=\"M20 6 9 17l-5-5\"></path>"],
		"ChevronDown": ["lucide-chevron-down", "<path d=\"m6 9 6 6 6-6\"></path>"],
		"CircleCheck": ["lucide-circle-check lucide-check-circle-2", "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m16 9-5.5 5.5L8 12\"></path>"],
		"Copy": ["lucide-copy", "<rect width=\"14\" height=\"14\" x=\"8\" y=\"8\" rx=\"2\" ry=\"2\"></rect><path d=\"M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2\"></path>"],
		"Download": ["lucide-download", "<path d=\"M12 15V3\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><path d=\"m7 10 5 5 5-5\"></path>"],
		"FolderOpen": ["lucide-folder-open", "<path d=\"m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2\"></path>"],
		"GripVertical": ["lucide-grip-vertical", "<circle cx=\"9\" cy=\"12\" r=\"1\"></circle><circle cx=\"9\" cy=\"5\" r=\"1\"></circle><circle cx=\"9\" cy=\"19\" r=\"1\"></circle><circle cx=\"15\" cy=\"12\" r=\"1\"></circle><circle cx=\"15\" cy=\"5\" r=\"1\"></circle><circle cx=\"15\" cy=\"19\" r=\"1\"></circle>"],
		"Info": ["lucide-info", "<circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"M12 16v-4\"></path><path d=\"M12 8h.01\"></path>"],
		"LayoutList": ["lucide-layout-list", "<rect width=\"7\" height=\"7\" x=\"3\" y=\"3\" rx=\"1\"></rect><rect width=\"7\" height=\"7\" x=\"3\" y=\"14\" rx=\"1\"></rect><path d=\"M14 4h7\"></path><path d=\"M14 9h7\"></path><path d=\"M14 15h7\"></path><path d=\"M14 20h7\"></path>"],
		"ListChecks": ["lucide-list-checks", "<path d=\"M13 5h8\"></path><path d=\"M13 12h8\"></path><path d=\"M13 19h8\"></path><path d=\"m3 17 2 2 4-4\"></path><path d=\"m3 7 2 2 4-4\"></path>"],
		"ListPlus": ["lucide-list-plus", "<path d=\"M16 5H3\"></path><path d=\"M11 12H3\"></path><path d=\"M16 19H3\"></path><path d=\"M18 9v6\"></path><path d=\"M21 12h-6\"></path>"],
		"Menu": ["lucide-menu", "<path d=\"M4 5h16\"></path><path d=\"M4 12h16\"></path><path d=\"M4 19h16\"></path>"],
		"MessageSquareText": ["lucide-message-square-text", "<path d=\"M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z\"></path><path d=\"M7 11h10\"></path><path d=\"M7 15h6\"></path><path d=\"M7 7h8\"></path>"],
		"Minus": ["lucide-minus", "<path d=\"M5 12h14\"></path>"],
		"Pencil": ["lucide-pencil", "<path d=\"M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z\"></path><path d=\"m15 5 4 4\"></path>"],
		"Plus": ["lucide-plus", "<path d=\"M5 12h14\"></path><path d=\"M12 5v14\"></path>"],
		"Redo2": ["lucide-redo-2", "<path d=\"m15 14 5-5-5-5\"></path><path d=\"M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13\"></path>"],
		"RotateCcw": ["lucide-rotate-ccw", "<path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"></path><path d=\"M3 3v5h5\"></path>"],
		"Save": ["lucide-save", "<path d=\"M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z\"></path><path d=\"M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7\"></path><path d=\"M7 3v4a1 1 0 0 0 1 1h7\"></path>"],
		"Ticket": ["lucide-ticket", "<path d=\"M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z\"></path><path d=\"M13 5v2\"></path><path d=\"M13 17v2\"></path><path d=\"M13 11v2\"></path>"],
		"Train": ["lucide-tram-front lucide-train", "<rect width=\"16\" height=\"16\" x=\"4\" y=\"3\" rx=\"2\"></rect><path d=\"M4 11h16\"></path><path d=\"M12 3v8\"></path><path d=\"m8 19-2 3\"></path><path d=\"m18 22-2-3\"></path><path d=\"M8 15h.01\"></path><path d=\"M16 15h.01\"></path>"],
		"Trash2": ["lucide-trash lucide-trash-2", "<path d=\"M10 11v6\"></path><path d=\"M14 11v6\"></path><path d=\"M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6\"></path><path d=\"M3 6h18\"></path><path d=\"M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"></path>"],
		"TriangleAlert": ["lucide-triangle-exclamation-point lucide-alert-triangle lucide-triangle-alert", "<path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3\"></path><path d=\"M12 9v4\"></path><path d=\"M12 17h.01\"></path>"],
		"Undo2": ["lucide-undo-2", "<path d=\"M9 14 4 9l5-5\"></path><path d=\"M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11\"></path>"],
		"Upload": ["lucide-upload", "<path d=\"M12 3v12\"></path><path d=\"m17 8-5-5-5 5\"></path><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path>"],
		"Users": ["lucide-users", "<path d=\"M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2\"></path><path d=\"M16 3.128a4 4 0 0 1 0 7.744\"></path><path d=\"M22 21v-2a4 4 0 0 0-3-3.87\"></path><circle cx=\"9\" cy=\"7\" r=\"4\"></circle>"],
		"X": ["lucide-x", "<path d=\"M18 6 6 18\"></path><path d=\"m6 6 12 12\"></path>"]
	};

	var NAMES = ["ArrowDown", "ArrowRight", "ArrowUp", "Bell", "Car", "CarTaxiFront", "Check", "ChevronDown", "CircleCheck", "Copy", "Download", "FolderOpen", "GripVertical", "Info", "LayoutList", "ListChecks", "ListPlus", "Menu", "MessageSquareText", "Minus", "Pencil", "Plus", "Redo2", "RotateCcw", "Save", "Ticket", "Train", "Trash2", "TriangleAlert", "Undo2", "Upload", "Users", "X"];

	var SOCIAL = {
		"web": "<svg class=\"icon-social\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zm6.93 6h-2.95a15.65 15.65 0 0 0-1.38-3.56A8.03 8.03 0 0 1 18.92 8zM12 4.04c.83 1.2 1.48 2.53 1.91 3.96h-3.82c.43-1.43 1.08-2.76 1.91-3.96zM4.26 14C4.1 13.36 4 12.69 4 12s.1-1.36.26-2h3.38c-.08.66-.14 1.32-.14 2s.06 1.34.14 2H4.26zm.82 2h2.95c.32 1.25.78 2.45 1.38 3.56A7.987 7.987 0 0 1 5.08 16zm2.95-8H5.08a7.987 7.987 0 0 1 4.33-3.56A15.65 15.65 0 0 0 8.03 8zM12 19.96c-.83-1.2-1.48-2.53-1.91-3.96h3.82c-.43 1.43-1.08 2.76-1.91 3.96zM14.34 14H9.66c-.09-.66-.16-1.32-.16-2s.07-1.35.16-2h4.68c.09.65.16 1.32.16 2s-.07 1.34-.16 2zm.25 5.56c.6-1.11 1.06-2.31 1.38-3.56h2.95a8.03 8.03 0 0 1-4.33 3.56zM16.36 14c.08-.66.14-1.32.14-2s-.06-1.34-.14-2h3.38c.16.64.26 1.31.26 2s-.1 1.36-.26 2h-3.38z\"></path></svg>",
		"linkedin": "<svg class=\"icon-social\" viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0z\"></path></svg>"
	};

	var SPLASH_CITY = "<svg class=\"cp-city\" viewBox=\"-1 -22 402 153\" preserveAspectRatio=\"xMidYMax meet\" aria-hidden=\"true\"><g><rect x=\"0\" y=\"58\" width=\"56\" height=\"72\" fill=\"#fff\"></rect><line x1=\"0\" y1=\"66\" x2=\"56\" y2=\"66\"></line><rect x=\"8\" y=\"74\" width=\"17\" height=\"10\" fill=\"#fff\"></rect><line x1=\"16.5\" y1=\"74\" x2=\"16.5\" y2=\"84\"></line><rect x=\"31\" y=\"74\" width=\"17\" height=\"10\" fill=\"#fff\"></rect><line x1=\"39.5\" y1=\"74\" x2=\"39.5\" y2=\"84\"></line><rect x=\"8\" y=\"87\" width=\"17\" height=\"10\" fill=\"#fff\"></rect><line x1=\"16.5\" y1=\"87\" x2=\"16.5\" y2=\"97\"></line><path d=\"M7 86 q9.5 -7 19 0\" fill=\"#fff\"></path><rect x=\"31\" y=\"87\" width=\"17\" height=\"10\" fill=\"#fff\"></rect><line x1=\"39.5\" y1=\"87\" x2=\"39.5\" y2=\"97\"></line><path d=\"M30 86 q9.5 -7 19 0\" fill=\"#fff\"></path><rect x=\"8\" y=\"100\" width=\"17\" height=\"10\" fill=\"#fff\"></rect><line x1=\"16.5\" y1=\"100\" x2=\"16.5\" y2=\"110\"></line><rect x=\"31\" y=\"100\" width=\"17\" height=\"10\" fill=\"#fff\"></rect><line x1=\"39.5\" y1=\"100\" x2=\"39.5\" y2=\"110\"></line><rect x=\"23\" y=\"116\" width=\"10\" height=\"14\" fill=\"#fff\"></rect></g><g><rect x=\"56\" y=\"18\" width=\"84\" height=\"112\" fill=\"#fff\"></rect><line x1=\"56\" y1=\"26\" x2=\"140\" y2=\"26\"></line><rect x=\"64\" y=\"34\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"79.5\" y1=\"34\" x2=\"79.5\" y2=\"44\"></line><rect x=\"101\" y=\"34\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"116.5\" y1=\"34\" x2=\"116.5\" y2=\"44\"></line><rect x=\"64\" y=\"56\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"79.5\" y1=\"56\" x2=\"79.5\" y2=\"66\"></line><rect x=\"101\" y=\"56\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"116.5\" y1=\"56\" x2=\"116.5\" y2=\"66\"></line><rect x=\"64\" y=\"78\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"79.5\" y1=\"78\" x2=\"79.5\" y2=\"88\"></line><path d=\"M63 77 q16.5 -7 33 0\" fill=\"#fff\"></path><rect x=\"101\" y=\"78\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"116.5\" y1=\"78\" x2=\"116.5\" y2=\"88\"></line><path d=\"M100 77 q16.5 -7 33 0\" fill=\"#fff\"></path><rect x=\"64\" y=\"100\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"79.5\" y1=\"100\" x2=\"79.5\" y2=\"110\"></line><path d=\"M63 99 q16.5 -7 33 0\" fill=\"#fff\"></path><rect x=\"101\" y=\"100\" width=\"31\" height=\"10\" fill=\"#fff\"></rect><line x1=\"116.5\" y1=\"100\" x2=\"116.5\" y2=\"110\"></line><path d=\"M100 99 q16.5 -7 33 0\" fill=\"#fff\"></path><rect x=\"93\" y=\"116\" width=\"10\" height=\"14\" fill=\"#fff\"></rect></g><g><rect x=\"140\" y=\"6\" width=\"52\" height=\"124\" fill=\"#fff\"></rect><line x1=\"140\" y1=\"14\" x2=\"192\" y2=\"14\"></line><rect x=\"150\" y=\"22\" width=\"16\" height=\"100\" fill=\"#fff\"></rect><line x1=\"158\" y1=\"22\" x2=\"158\" y2=\"122\"></line><line x1=\"150\" y1=\"33.111111111111114\" x2=\"166\" y2=\"33.111111111111114\"></line><line x1=\"150\" y1=\"44.22222222222222\" x2=\"166\" y2=\"44.22222222222222\"></line><line x1=\"150\" y1=\"55.33333333333333\" x2=\"166\" y2=\"55.33333333333333\"></line><line x1=\"150\" y1=\"66.44444444444444\" x2=\"166\" y2=\"66.44444444444444\"></line><line x1=\"150\" y1=\"77.55555555555556\" x2=\"166\" y2=\"77.55555555555556\"></line><line x1=\"150\" y1=\"88.66666666666666\" x2=\"166\" y2=\"88.66666666666666\"></line><line x1=\"150\" y1=\"99.77777777777777\" x2=\"166\" y2=\"99.77777777777777\"></line><line x1=\"150\" y1=\"110.88888888888889\" x2=\"166\" y2=\"110.88888888888889\"></line><line x1=\"174\" y1=\"28\" x2=\"186\" y2=\"28\"></line><line x1=\"174\" y1=\"46\" x2=\"186\" y2=\"46\"></line><line x1=\"174\" y1=\"64\" x2=\"186\" y2=\"64\"></line><line x1=\"174\" y1=\"82\" x2=\"186\" y2=\"82\"></line><line x1=\"174\" y1=\"100\" x2=\"186\" y2=\"100\"></line><line x1=\"174\" y1=\"118\" x2=\"186\" y2=\"118\"></line></g><g><rect x=\"192\" y=\"68\" width=\"66\" height=\"62\" fill=\"#fff\"></rect><line x1=\"192\" y1=\"76\" x2=\"258\" y2=\"76\"></line><rect x=\"200\" y=\"84\" width=\"22\" height=\"10\" fill=\"#fff\"></rect><line x1=\"211\" y1=\"84\" x2=\"211\" y2=\"94\"></line><line x1=\"198\" y1=\"82\" x2=\"224\" y2=\"82\"></line><line x1=\"198\" y1=\"96\" x2=\"224\" y2=\"96\"></line><rect x=\"228\" y=\"84\" width=\"22\" height=\"10\" fill=\"#fff\"></rect><line x1=\"239\" y1=\"84\" x2=\"239\" y2=\"94\"></line><line x1=\"226\" y1=\"82\" x2=\"252\" y2=\"82\"></line><line x1=\"226\" y1=\"96\" x2=\"252\" y2=\"96\"></line><rect x=\"200\" y=\"100\" width=\"22\" height=\"10\" fill=\"#fff\"></rect><line x1=\"211\" y1=\"100\" x2=\"211\" y2=\"110\"></line><line x1=\"198\" y1=\"98\" x2=\"224\" y2=\"98\"></line><line x1=\"198\" y1=\"112\" x2=\"224\" y2=\"112\"></line><rect x=\"228\" y=\"100\" width=\"22\" height=\"10\" fill=\"#fff\"></rect><line x1=\"239\" y1=\"100\" x2=\"239\" y2=\"110\"></line><line x1=\"226\" y1=\"98\" x2=\"252\" y2=\"98\"></line><line x1=\"226\" y1=\"112\" x2=\"252\" y2=\"112\"></line><rect x=\"220\" y=\"116\" width=\"10\" height=\"14\" fill=\"#fff\"></rect></g><g><rect x=\"258\" y=\"34\" width=\"74\" height=\"96\" fill=\"#fff\"></rect><line x1=\"258\" y1=\"42\" x2=\"332\" y2=\"42\"></line><rect x=\"266\" y=\"50\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"273.6666666666667\" y1=\"50\" x2=\"273.6666666666667\" y2=\"60\"></line><rect x=\"287.3333333333333\" y=\"50\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"295\" y1=\"50\" x2=\"295\" y2=\"60\"></line><rect x=\"308.6666666666667\" y=\"50\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"316.33333333333337\" y1=\"50\" x2=\"316.33333333333337\" y2=\"60\"></line><rect x=\"266\" y=\"75\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"273.6666666666667\" y1=\"75\" x2=\"273.6666666666667\" y2=\"85\"></line><rect x=\"287.3333333333333\" y=\"75\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"295\" y1=\"75\" x2=\"295\" y2=\"85\"></line><rect x=\"308.6666666666667\" y=\"75\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"316.33333333333337\" y1=\"75\" x2=\"316.33333333333337\" y2=\"85\"></line><rect x=\"266\" y=\"100\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"273.6666666666667\" y1=\"100\" x2=\"273.6666666666667\" y2=\"110\"></line><rect x=\"287.3333333333333\" y=\"100\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"295\" y1=\"100\" x2=\"295\" y2=\"110\"></line><rect x=\"308.6666666666667\" y=\"100\" width=\"15.333333333333334\" height=\"10\" fill=\"#fff\"></rect><line x1=\"316.33333333333337\" y1=\"100\" x2=\"316.33333333333337\" y2=\"110\"></line><rect x=\"290\" y=\"116\" width=\"10\" height=\"14\" fill=\"#fff\"></rect></g><g><rect x=\"332\" y=\"84\" width=\"68\" height=\"46\" fill=\"#fff\"></rect><line x1=\"332\" y1=\"92\" x2=\"400\" y2=\"92\"></line><rect x=\"340\" y=\"100\" width=\"23\" height=\"10\" fill=\"#fff\"></rect><line x1=\"351.5\" y1=\"100\" x2=\"351.5\" y2=\"110\"></line><path d=\"M339 99 q12.5 -7 25 0\" fill=\"#fff\"></path><rect x=\"369\" y=\"100\" width=\"23\" height=\"10\" fill=\"#fff\"></rect><line x1=\"380.5\" y1=\"100\" x2=\"380.5\" y2=\"110\"></line><path d=\"M368 99 q12.5 -7 25 0\" fill=\"#fff\"></path><rect x=\"340\" y=\"112\" width=\"23\" height=\"10\" fill=\"#fff\"></rect><line x1=\"351.5\" y1=\"112\" x2=\"351.5\" y2=\"122\"></line><rect x=\"369\" y=\"112\" width=\"23\" height=\"10\" fill=\"#fff\"></rect><line x1=\"380.5\" y1=\"112\" x2=\"380.5\" y2=\"122\"></line></g></svg>";

	var CAR_ART = "<svg class=\"car-art\" viewBox=\"0 0 300 560\" aria-hidden=\"true\"><g class=\"tire\"><rect x=\"8\" y=\"64\" width=\"22\" height=\"64\" rx=\"8\"></rect><rect x=\"270\" y=\"64\" width=\"22\" height=\"64\" rx=\"8\"></rect><rect x=\"8\" y=\"388\" width=\"22\" height=\"64\" rx=\"8\"></rect><rect x=\"270\" y=\"388\" width=\"22\" height=\"64\" rx=\"8\"></rect></g><path class=\"body\" d=\"M22 90 C22 40 70 8 150 8 C230 8 278 40 278 90 L278 133 L296 146 Q303 150 303 156 L303 160 Q303 164 298 164 L278 164 L278 470 C278 530 240 556 150 556 C60 556 22 530 22 470 L22 164 L2 164 Q-3 164 -3 160 L-3 156 Q-3 150 4 146 L22 133 Z\"></path><path class=\"grille\" d=\"M112 16 C130 10 170 10 188 16 L182 34 C166 30 134 30 118 34 Z\"></path><path class=\"lamp\" d=\"M44 58 C54 42 78 30 104 28 L98 60 C80 60 60 62 44 58 Z\"></path><path class=\"lamp\" d=\"M256 58 C246 42 222 30 196 28 L202 60 C220 60 240 62 256 58 Z\"></path><path class=\"crease\" d=\"M110 60 C104 80 104 96 108 104\"></path><path class=\"crease\" d=\"M190 60 C196 80 196 96 192 104\"></path><path class=\"glass\" d=\"M38 150 C58 112 104 98 150 98 C196 98 242 112 262 150 L250 196 C222 186 78 186 50 196 Z\"></path><path class=\"glass\" d=\"M26 212 L47 198 L47 396 L28 420 Z\"></path><path class=\"glass\" d=\"M274 212 L253 198 L253 396 L272 420 Z\"></path><path class=\"glass\" d=\"M52 404 C80 410 220 410 248 404 L262 450 C236 466 190 472 150 472 C110 472 64 466 38 450 Z\"></path><path class=\"seam\" d=\"M26 308 H47 M274 308 H253\"></path><path class=\"roof\" d=\"M50 196 C78 186 222 186 250 196 L250 382 Q250 398 234 398 L66 398 Q50 398 50 382 Z\"></path><path class=\"shine\" d=\"M52 300 C90 270 150 236 214 196 C236 192 246 194 250 196 L250 250 C200 300 130 360 66 398 Q52 396 52 382 Z\"></path><path class=\"tail\" d=\"M32 500 C36 526 52 540 76 542 L78 520 C60 520 44 512 32 500 Z\"></path><path class=\"tail\" d=\"M268 500 C264 526 248 540 224 542 L222 520 C240 520 256 512 268 500 Z\"></path><rect class=\"plate\" x=\"124\" y=\"534\" width=\"52\" height=\"12\" rx=\"3\"></rect></svg>";

	// same escaping as React uses for attribute values
	function esc(value) {
		return String(value).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
	}

	// "lucide lucide-<name> <className>", empty and repeated class names dropped (as lucide does)
	function classNames(base, extra) {
		var all = ("lucide " + base + " " + (extra || "")).split(" ");
		var seen = [];
		var i;
		for (i = 0; i < all.length; i++) {
			if (all[i] && seen.indexOf(all[i]) === -1) {
				seen.push(all[i]);
			}
		}
		return seen.join(" ");
	}

	/**
	 * A lucide icon as SVG string, like <Name size={size} strokeWidth={opts.strokeWidth} className={opts.className} aria-hidden />.
	 * @param {string} name lucide component name, e.g. "TriangleAlert"
	 * @param {number|string} [size=24] width and height, a number or e.g. "100%"
	 * @param {object} [opts] strokeWidth (default 2), className
	 * @returns {string} the svg markup
	 */
	function icon(name, size, opts) {
		var def = ICONS[name];
		var o = opts || {};
		var sz = size === undefined || size === null ? 24 : size;
		var sw = o.strokeWidth === undefined || o.strokeWidth === null ? 2 : o.strokeWidth;
		if (!def) {
			throw new Error("icons: unknown icon \"" + name + "\"");
		}
		return "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"" + esc(sz) + "\" height=\"" + esc(sz) + "\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"" + esc(sw) +
			"\" stroke-linecap=\"round\" stroke-linejoin=\"round\" class=\"" + esc(classNames(def[0], o.className)) + "\" aria-hidden=\"true\">" + def[1] + "</svg>";
	}

	/**
	 * Footer icons of src/SocialIcons.jsx.
	 * @param {string} name "web" or "linkedin"
	 * @returns {string} the svg markup
	 */
	function social(name) {
		if (!SOCIAL.hasOwnProperty(name)) {
			throw new Error("icons: unknown social icon \"" + name + "\"");
		}
		return SOCIAL[name];
	}

	/**
	 * Skyline of the loading screen (SplashCity.jsx).
	 * @returns {string} the svg markup
	 */
	function splashCity() {
		return SPLASH_CITY;
	}

	/**
	 * Top view of the car behind the seat plan (the svg.car-art of CarMap in Seats.jsx).
	 * @returns {string} the svg markup
	 */
	function carArt() {
		return CAR_ART;
	}

	return { icon: icon, social: social, splashCity: splashCity, carArt: carArt, NAMES: NAMES };
});
