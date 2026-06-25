function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
const Icon = ({
  name,
  size = 16,
  className = "",
  style = {}
}) => {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
    style
  };
  switch (name) {
    case "folder":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
      }));
    case "folder-open":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v.5"
      }), React.createElement("path", {
        d: "m3 10 1.6 7.2A2 2 0 0 0 6.55 19h11.9a2 2 0 0 0 1.95-1.6L22 10H3Z"
      }));
    case "inbox":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M22 12h-6l-2 3h-4l-2-3H2"
      }), React.createElement("path", {
        d: "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z"
      }));
    case "star":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
      }));
    case "star-fill":
      return React.createElement("svg", _extends({}, props, {
        fill: "currentColor",
        stroke: "none"
      }), React.createElement("path", {
        d: "m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2Z"
      }));
    case "search":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "11",
        cy: "11",
        r: "7"
      }), React.createElement("path", {
        d: "m20 20-3.5-3.5"
      }));
    case "plus":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M12 5v14M5 12h14"
      }));
    case "minus":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M5 12h14"
      }));
    case "more":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "5",
        cy: "12",
        r: "1.2",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "1.2",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "19",
        cy: "12",
        r: "1.2",
        fill: "currentColor"
      }));
    case "copy":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "9",
        y: "9",
        width: "11",
        height: "11",
        rx: "2"
      }), React.createElement("path", {
        d: "M5 15V5a2 2 0 0 1 2-2h10"
      }));
    case "check":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M20 6 9 17l-5-5"
      }));
    case "x":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M18 6 6 18M6 6l12 12"
      }));
    case "trash":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"
      }));
    case "undo":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M3 7v6h6"
      }), React.createElement("path", {
        d: "M21 17a9 9 0 0 0-15-6.7L3 13"
      }));
    case "menu":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M4 6h16M4 12h16M4 18h16"
      }));
    case "moon":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z"
      }));
    case "monitor":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "2",
        y: "3",
        width: "20",
        height: "14",
        rx: "2"
      }), React.createElement("path", {
        d: "M8 21h8M12 17v4"
      }));
    case "sun":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "4"
      }), React.createElement("path", {
        d: "M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
      }));
    case "download":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"
      }));
    case "terminal":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m4 7 4 4-4 4M11 15h8"
      }), React.createElement("rect", {
        x: "2",
        y: "3",
        width: "20",
        height: "18",
        rx: "2"
      }));
    case "doc":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
      }), React.createElement("path", {
        d: "M14 2v6h6M9 13h6M9 17h6"
      }));
    case "tag":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82Z"
      }), React.createElement("circle", {
        cx: "7",
        cy: "7",
        r: "1",
        fill: "currentColor"
      }));
    case "link":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
      }), React.createElement("path", {
        d: "M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
      }));
    case "edit":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
      }), React.createElement("path", {
        d: "M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5Z"
      }));
    case "image":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }), React.createElement("circle", {
        cx: "9",
        cy: "9",
        r: "2"
      }), React.createElement("path", {
        d: "m21 15-5-5L5 21"
      }));
    case "table":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "3",
        y: "3",
        width: "18",
        height: "18",
        rx: "2"
      }), React.createElement("path", {
        d: "M3 9h18M3 15h18M9 3v18M15 3v18"
      }));
    case "check-square":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M9 11l3 3 8-8"
      }), React.createElement("path", {
        d: "M20 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"
      }));
    case "code":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m16 18 6-6-6-6M8 6l-6 6 6 6"
      }));
    case "type":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M4 7V5h16v2M9 19h6M12 5v14"
      }));
    case "heading":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M6 4v16M18 4v16M6 12h12"
      }));
    case "external":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
      }), React.createElement("path", {
        d: "M15 3h6v6M10 14 21 3"
      }));
    case "grip":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "9",
        cy: "6",
        r: "1",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "9",
        cy: "12",
        r: "1",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "9",
        cy: "18",
        r: "1",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "15",
        cy: "6",
        r: "1",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "15",
        cy: "12",
        r: "1",
        fill: "currentColor"
      }), React.createElement("circle", {
        cx: "15",
        cy: "18",
        r: "1",
        fill: "currentColor"
      }));
    case "chevron-left":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m15 18-6-6 6-6"
      }));
    case "chevron-right":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m9 18 6-6-6-6"
      }));
    case "chevron-down":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m6 9 6 6 6-6"
      }));
    case "filter":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M22 3H2l8 9.46V19l4 2v-8.54L22 3Z"
      }));
    case "calendar":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "3",
        y: "4",
        width: "18",
        height: "18",
        rx: "2"
      }), React.createElement("path", {
        d: "M16 2v4M8 2v4M3 10h18"
      }));
    case "alert":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), React.createElement("path", {
        d: "M12 8v4M12 16h.01"
      }));
    case "check-circle":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M22 11.08V12a10 10 0 1 1-5.93-9.14"
      }), React.createElement("path", {
        d: "m9 11 3 3L22 4"
      }));
    case "settings":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }), React.createElement("path", {
        d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      }));
    case "pin":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1v3.76Z"
      }));
    case "home":
      return React.createElement("svg", props, React.createElement("path", {
        d: "m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4v-7h-6v7H5a2 2 0 0 1-2-2Z"
      }));
    case "server":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "2",
        y: "3",
        width: "20",
        height: "8",
        rx: "2"
      }), React.createElement("rect", {
        x: "2",
        y: "13",
        width: "20",
        height: "8",
        rx: "2"
      }), React.createElement("path", {
        d: "M6 7h.01M6 17h.01"
      }));
    case "database":
      return React.createElement("svg", props, React.createElement("ellipse", {
        cx: "12",
        cy: "5",
        rx: "9",
        ry: "3"
      }), React.createElement("path", {
        d: "M3 5v6c0 1.66 4 3 9 3s9-1.34 9-3V5"
      }), React.createElement("path", {
        d: "M3 11v6c0 1.66 4 3 9 3s9-1.34 9-3v-6"
      }));
    case "cloud":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M17.5 19a4.5 4.5 0 1 0-.8-8.93 6 6 0 0 0-11.7 1.93 4 4 0 0 0 .5 7Z"
      }));
    case "key":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "7.5",
        cy: "15.5",
        r: "3.5"
      }), React.createElement("path", {
        d: "m21 2-9.6 9.6M15.5 7.5l3 3 3-3-3-3Z"
      }));
    case "lock":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "3",
        y: "11",
        width: "18",
        height: "11",
        rx: "2"
      }), React.createElement("path", {
        d: "M7 11V7a5 5 0 0 1 10 0v4"
      }));
    case "unlock":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "3",
        y: "11",
        width: "18",
        height: "11",
        rx: "2"
      }), React.createElement("path", {
        d: "M7 11V7a5 5 0 0 1 9.9-1"
      }));
    case "bell":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"
      }));
    case "zap":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M13 2 3 14h9l-1 8 10-12h-9l1-8Z"
      }));
    case "target":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "6"
      }), React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "2"
      }));
    case "package":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M16.5 9.4 7.55 4.24M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
      }), React.createElement("path", {
        d: "m3.27 6.96 8.73 5.05 8.73-5.05M12 22.08V12"
      }));
    case "globe":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), React.createElement("path", {
        d: "M2 12h20M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10 15 15 0 0 1 4-10Z"
      }));
    case "user":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      }), React.createElement("circle", {
        cx: "12",
        cy: "7",
        r: "4"
      }));
    case "mail":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "2",
        y: "4",
        width: "20",
        height: "16",
        rx: "2"
      }), React.createElement("path", {
        d: "m22 7-10 6L2 7"
      }));
    case "heart":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78Z"
      }));
    case "flag":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M4 22V4a1 1 0 0 1 .4-.8 6 6 0 0 1 7.2 0 6 6 0 0 0 7.2 0 1 1 0 0 1 1.2 1V15a1 1 0 0 1-.4.8 6 6 0 0 1-7.2 0 6 6 0 0 0-7.2 0"
      }));
    case "fire":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5Z"
      }));
    case "briefcase":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "2",
        y: "7",
        width: "20",
        height: "14",
        rx: "2"
      }), React.createElement("path", {
        d: "M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"
      }));
    case "archive":
      return React.createElement("svg", props, React.createElement("rect", {
        x: "2",
        y: "3",
        width: "20",
        height: "5",
        rx: "1"
      }), React.createElement("path", {
        d: "M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M10 12h4"
      }));
    case "clock":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), React.createElement("path", {
        d: "M12 6v6l4 2"
      }));
    case "eye":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"
      }), React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }));
    case "smile":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), React.createElement("path", {
        d: "M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"
      }));
    case "bookmark":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"
      }));
    case "compass":
      return React.createElement("svg", props, React.createElement("circle", {
        cx: "12",
        cy: "12",
        r: "10"
      }), React.createElement("path", {
        d: "m16.24 7.76-2.83 5.66-5.66 2.83 2.83-5.66Z"
      }));
    case "wrench":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M14.7 6.3a4 4 0 0 0-5.66 5.66l-6.34 6.34a1 1 0 0 0 0 1.41l1.59 1.59a1 1 0 0 0 1.41 0l6.34-6.34a4 4 0 0 0 5.66-5.66l-2.83 2.83-2.83-2.83Z"
      }));
    case "shield":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"
      }));
    case "git-branch":
      return React.createElement("svg", props, React.createElement("line", {
        x1: "6",
        y1: "3",
        x2: "6",
        y2: "15"
      }), React.createElement("circle", {
        cx: "18",
        cy: "6",
        r: "3"
      }), React.createElement("circle", {
        cx: "6",
        cy: "18",
        r: "3"
      }), React.createElement("path", {
        d: "M18 9a9 9 0 0 1-9 9"
      }));
    case "history":
      return React.createElement("svg", props, React.createElement("path", {
        d: "M3 12a9 9 0 1 0 3-6.7L3 8"
      }), React.createElement("path", {
        d: "M3 3v5h5"
      }), React.createElement("path", {
        d: "M12 7v5l3 2"
      }));
    default:
      return null;
  }
};
window.Icon = Icon;