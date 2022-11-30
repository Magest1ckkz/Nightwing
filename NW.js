/*
	NW.js
	a node.js bot for trollbox.party
	developed by Magestick, Dragsun, cryolazulite
	licensed under MIT License
*/

// import
function get_key_by_value(object, value) {
	return Object.keys(object).find(key => object[key] === value)
}

function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const braile_map = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=".split("").reduce((o, n, i) => {
	return o[n] = "⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿"[i],
	       o[n.toLowerCase()] = o[n], o;
}, {});

function toBraile(string) {
	return string.split("").braile_map(c => map[c]).join("");
}

// node.js includes
const io = require("socket.io-client")
const socket = io("https://trollbox.party/", {
	path: "/api/v0/si"
})
const he = require("he")
const os = require("os") // use it and don't complain
const fs = require("fs")
const replaceAll = require("string.prototype.replaceall")
replaceAll.shim()
const { VM } = require("vm2") // it's now possible to use os I guess

// global declarations
var privilege_key = {
	"User"     : 1,
	"Moderator": 2,
	"Superuser": 3,
	"Owner"    : 4
}
var admstr = Object.keys(privilege_key)

var privileges = {
	"FFF38787JKDS3Z1E133CMEHDSMFF3M3F": privilege_key["Owner"], // Magestick
	"EF1ASZFZ1HH24AS3CE1FASZEEHECFFMH": privilege_key["Superuser"], // Anton
	"DS13387Z1EDSDS1ZASHDSDSE12EM2372": privilege_key["Superuser"], // Snowpix I guess
	"EDS873CZCASH3FZH3Z187ASZ4M43Z1JK": privilege_key["Superuser"], // FidgetSpinzz
	"ECFF3873JKZ1CE287ZDSAS3FJKF187HZ": privilege_key["Superuser"], // cryolazulite
}

var privileges = {}
var myhome = ""

const userfiles = "./PublicData/"
const path_privileges = "./privileges.json"
const path_blacklist = "./blacklist.json"

let freeze_timeout_handler = false
var frozen = false

var current_users = {}

const mynick = `NW.js [${ pref }]`
const mycolor = "royalblue"

const regex_pref = new RegExp(`^${ escapeRegExp(pref) }\\w+`, "g")
const regex_devpref = new RegExp(`^${ escapeRegExp(devpref) }\\w+`, "g")

// procedures
function load_obj(fp) {
	try {
		return JSON.parse(fs.readFileSync(fp))
	} catch(e) {
		// case 1: cannot access file or it does not exists
		// case 2: bad JSON
		if (e.code == "ENOENT" || e.toString().includes("in JSON"))
			return false
	}
}

function save_obj(fp, obj) {
	try {
		fs.writeFileSync(fp, JSON.stringify(obj))
		return true
	} catch(e) {
		// not much to handle
		return false
	}
}

function load_config() {
	let res = true
	var loaded = load_obj(path_privileges)
	if (typeof loaded === "object") {
		privileges = res
		myhome = get_key_by_value(privilege_key["Owner"])
	} else if (loaded === false) {
		privileges = {}
		myhome = "---"
		res = false
	}

	var loaded = load_obj(path_blacklist)
	if (typeof loaded === "object") {
		blacklist = loaded["blacklist"] // a list
	} else if (loaded === false) {
		blacklist = []
		// does not matters
	}
	return res
}

function save_config() {
	let res = true
	var saved = save_obj(path_privileges, privileges)
	res = saved
	var saved = save_obj(path_blacklist, {"blacklist": blacklist})
	res = res && saved // don't set it to true if it is false
	return res
}

function check_if_this_privilege_or_higher(source, needle) {
	// decided to put it simply, classic <for> loop
	for (let i = 0; i < Object.entries(privileges).length; i++) {
		let home = Object.keys(privileges)[i]
		let level = Object.values(privileges)[i]
		if (home == source && level >= privilege_key[needle])
			return true
	}
	return false
}

function level_to_privilege_name(level) {
	return get_key_by_value(privilege_key, level)
}

function form_userinfo(name, colors, homes) {
	if (typeof colors === "string")
		colors = [colors]
	if (typeof homes === "string")
		homes = [homes]
	say(  "• Name: " + name +
	    `\n• Color${ (colors.length > 1) ? "s" : "" }: ` + colors.join(", ") +
	    "\n• Home: " + homes.join(", ") +
	    "\n• Permission level: " + level_to_privilege_name(privileges[homes[0]])) // should display all of them, linked to homes
}

function ban_user(home) {
	blacklist.append(home)
}

function unban_user(home) {
	blacklist.splice(blacklist.indexOf(home), 1)
}

function freeze() {
	frozen = true
	freeze_timeout_handler = setTimeout( () => {
		shutdown()
	}, 1 * 3600 * 1e3) // 1 hour
}

function unfreeze() {
	frozen = false
	clearTimeout(freeze_timeout_handler)
}

function shutdown() {
	save_config()
	process.exit()
}

function find_home(username) {
	// W.I.P.
	/*
	var homes = []
	for (let key in current_users) {
		current_users[key].forEach(value => {
			if (value[0] == username)
				homes.push(key)
		})
	}
	return homes
	*/
}

function say(message) {
	let first_delay = 700
	let second_delay = 450

	setTimeout(() => {
		socket.send(message);
		setTimeout(() => {
			socket.send("");
		}, first_delay + second_delay)
	}, first_delay)
}

function form_keyequal() {
	// actually a useful function
	let args = Object.values(arguments)
	var res = new Object()
	args.forEach(function(value) {
		res[value] = eval(value)
	})
	return res
}

function vmrun(code) { // keep it before socket.on("message") please, do not move
	let imported_readonly_globals = [
		"console",
		"socket.emit",
		"say",
		"os",
		"fs"
	]
	let nevermind = new VM({
		timeout: 1e3,
		allowAsync: false,
		sandbox: form_keyequal(...imported_readonly_globals)
	})
	imported_readonly_globals.forEach(value => {
		eval(`nevermind.freeze(${ value }, "${ value.replaceAll('"', '\\"') }")`)
	})
	return nevermind.run(code)
}

// main code, part 1. event handlers.
socket.on("message", function(data) {
	var is_me = data.nick == mynick && (data.home == myhome || myhome == "---");
	var is_system = data.home === "trollbox";
	var do_not_process = is_me || is_system;
	if (do_not_process) return

	data.msg = he.decode(data.msg)
	var msg = data.msg.trim()
	var test_pref = msg.match(regex_pref)
	var test_devpref = msg.match(regex_devpref)
	let is_dev_command = false
	if (test_devpref) {
		is_dev_command = true
		msg = msg.slice(devpref.length)
	} else if (test_pref) {
		msg = msg.slice(pref.length)
	} else {
		return // it's not a command, ignore
	}
	var args = msg.split(" ")
	var duck = args.splice(1).join(" ")
	var command = args[0]

	if (command == "unfreeze" && is_dev_command) {
		unfreeze()
	} else if (command == "freeze" && is_dev_command) {
		freeze()
	}

	if (command == "help") {
		say(`\
**NW.js v0.1.0 ALPHA 3**

${ pref }help - Shows this message
${ pref }say - Say something!
${ pref }userinfo <user> - User info (Name, Color, Home, Perms)
${ pref }save <filename without spaces> <content> - Save a text file
${ pref }load <filename without spaces> - Load a text file
${ devpref }freeze **[SUPERUSER ONLY]** - Freeze bot (stop reacting to commands)
${ devpref }unfreeze **[SUPERUSER ONLY]** - Unfreeze bot (continue reacting to commands)
${ devpref }shutdown **[SUPERUSER ONLY]** - Shut down the bot
${ devpref }evaljs **[SUPERUSER ONLY]** - Execute js! [very dangerous]`)
	} else if (command == "load") {
		var shorthand = args[0]
		var fn = userfiles + shorthand + ".txt"

		try {
			var contents = fs.readFileSync(fn, { encoding: "utf8" })
		} catch(e) {
			if (e.code == "ENOENT") {
				say(`man there's literally no "${ args[0] }" file`)
			}
			console.log(e.toString())
		}
		say("File contents:\n" + data)
	} else if (command == "save") {
		var shorthand = args[0]
		var fn = userfiles + shorthand + ".txt"

		if (!fs.existsSync(userfiles)) {
			fs.mkdirSync(userfiles);
		}

		var contents = "" + args.splice(2).join(" ")
		try {
			fs.writeFileSync(fn, contents, { encoding: "utf8" })
		} catch(e) {
			if (e.code == "ENOENT") {
				say("This file couldn't be saved because it have either illegal symbols, or the file name is too long");
			}
			console.log(e.toString())
		}
		say(`file saved! use "+load ${ shorthand }" to read it!`)
	} else if (command == "userinfo") {
		if (duck != "") {
			let username = duck
			let homes_of_username = find_home(username)
			if (current_users[username]) {
				let msg = `Home has ${ current_users[username].length } name${ current_users[username].length > 1 ? "s" : "" } attached to it:`;
				current_users[username].forEach(function(value, index) {
					msg += `\n ${ value[0] }, with the color of ${ value[1] }`
				})
				say(msg + `\n(And the perms of ${ level_to_privilege_name(privileges[homes_of_username]) })`);
			} else if (homes_of_username.length == 1) {
				let infos = current_users[homes_of_username[0]]
				form_userinfo(infos[0], infos[1], homes_of_username)
			} else if (homes_of_username.length > 1) {
				let colors = current_users[username][1]
				form_userinfo(username, colors, homes_of_username)
			}
		} else {
			// for them
			form_userinfo(data.nick, data.color, data.home)
		}
	} else if (command == "evaljs" && is_dev_command) {
		if (check_if_this_privilege_or_higher(data.home, "Admin")) {
			if (duck == "") {
				say("Wrong format!");
				return "missing arg";
			}
			try {
				/*
				Stop using this because:
				It's possible to obfuscate code so that the bot cannot match
				"child_process" and allows the code to be actually executed
				example: (function(_0x29bdc6,_0x60ea19){var _0x36604f=_0x29bdc6();...
				         ↑ contains child_process

				if (duck.toLowerCase().includes('child_process')){
					say("ERROR: Illegal access to computer detected!")
					return "illegal";
					}
				*/

				var result = vmrun(duck);
				// say("> "+eval(duck)); equal to the line below ↓
				say(`> ${ result }`); // better than the line above ↑
			} catch (e) {
				say(`*${ e.toString() }*`);
			}
		} else {
			say("❌ No admin permissions.")
		}
	} else if (command == "say") {
		if (duck == "") {
			say("Missing argument!");
			return "missing arg";
		}
		say(duck);
	} else if (command == "test") {
		if (duck == "") {
			say("Missing argument!")
			return "missing arg";
		}
		say(toBraile(duck));
	}
})

socket.on("update users", function(data) {
	/* wtf is this?..
	for (let key in data) {
		let home = data[key].home
		if (!current_users[home]) {
			current_users[home] = []
		}
		current_users[home].push([(data[key].nick), data[key].color])
	}
	*/
	current_users = {} // empty it
	data.forEach((user) => {
		let username = ""
		let color = ""
		let home = ""
		Object.keys(user).forEach((key) => {
			let value = user[key]
			if (key == "nick") {
				username = value
			} else if (key == "color") {
				color = value
			} else if (key == "home") {
				home = value
			}
		})
	})
})

// main code, part 2
socket.emit("user joined", mynick, mycolor, "", "")
