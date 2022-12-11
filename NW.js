/*
	NW.js
	a node.js bot for trollbox.party
	developed by Magestick, Dragsun, cryolazulite
	licensed under MIT License
*/

console.log("The starting process began.")

console.log("Setting functions and values...")

// import
function get_key_by_value(object, value) {
	return Object.keys(object).find(key => object[key] === value)
}

function escapeRegExp(string) {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const braile_map = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=".split("").reduce((o, n, i) => {
	return o[n] = "⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿"[i],
	       o[n.toLowerCase()] = o[n], o
}, {})

function toBraile(string) {
	return string.split("").braile_map(c => map[c]).join("")
}

// node.js includes
const io = require("socket.io-client")
const socket = io("https://trollbox.party/", {
	path: "/api/v0/si"
})
const he = require("he")
const keypress = require("keypress")
const os = require("os")
const fs = require("fs")
const replaceAll = require("string.prototype.replaceall")
replaceAll.shim()
const { VM } = require("vm2")

// global declarations
const privilege_key = {
	"User"     : 1,
	"Moderator": 2,
	"Superuser": 3,
	"Owner"    : 4
}
let admstr = Object.keys(privilege_key)


let privileges = {
	"FFF38787JKDS3Z1E133CMEHDSMFF3M3F": privilege_key["Owner"], // Magestick
	"EF1ASZFZ1HH24AS3CE1FASZEEHECFFMH": privilege_key["Superuser"], // Anton
	"DS13387Z1EDSDS1ZASHDSDSE12EM2372": privilege_key["Superuser"],
	"EDS873CZCASH3FZH3Z187ASZ4M43Z1JK": privilege_key["Superuser"], // FidgetSpinzz
	"MASZM3CM7HMFZ3HFH21FFZ3JKFZ321DS": privilege_key["Superuser"], // cryolazulite
}


// let privileges = {}
let blacklist = {}
let myhome = ""

const userfiles = "./PublicData/"
const path_privileges = "./privileges.json"
const path_blacklist = "./blacklist.json"

let freeze_timeout_handler = false
let frozen = false

let current_users = {}

const pref = "+"
const devpref = "+/"

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
	let loaded = load_obj(path_privileges)
	if (typeof loaded === "object") {
		privileges = loaded
		Object.keys(privileges).forEach(key => {
			let value = res[key]
			privileges[key] = privilege_key[value]
		})
		myhome = get_key_by_value(privileges, privilege_key["Owner"])
	} else if (loaded === false) {
		privileges = {}
		myhome = "---"
		res = false
	}

	loaded = load_obj(path_blacklist)
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
	let saved = save_obj(path_privileges, privileges)
	res = saved
	saved = save_obj(path_blacklist, {"blacklist": blacklist})
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
	say(
		  "• Name: " + he.decode(name) +
	    `\n• Color${ (colors.length > 1) ? "s" : "" }: ` + colors.join(", ") +
	    `\n• Home${ (homes.length > 1) ? "s" : "" }: ` + homes.join(", ") +
	    "\n• Permission level: " + level_to_privilege_name(privileges[homes[0]]) // should display all of them, linked to homes
	)
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
	say(he.decode("+freeze &#x2744;&#xFE0F;"))
	console.log("The bot is frozen now.")
}

function unfreeze() {
	frozen = false
	clearTimeout(freeze_timeout_handler)
	say("Unfreezing... I can respond to commands again!")
	console.log("The bot responds to commands again.")
}

function shutdown() {
	console.log("Shutting down...")
	save_config()
	process.exit()
}

function find_home(username) {
	let found_homes = []
	Object.keys(current_users).forEach(key => {
		let value = current_users[key]
		if (value[0] == username)
			found_homes.push(key)
	})
	return found_homes
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
	let res = new Object()
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
		allowAsync: false
	})
	imported_readonly_globals.forEach(value => {
		eval(`nevermind.freeze(${ value }, "${ value.replaceAll('"', '\\"') }")`)
	})
	return nevermind.run(code)
}

function keyhandle(a, kbinfo) {
	if (!kbinfo)
		return

	let key = kbinfo.name
	if (key == "s") {
		return shutdown()
	}
}

// main code, part 1. initialization.
console.log("Loading configurations...")
load_config()

// main code, part 2. event handlers.
console.log("Setting keyboard event handler...")
keypress(process.stdin)
process.stdin.on("keypress", keyhandle)
process.stdin.setRawMode(true)
process.stdin.resume()

console.log("Authenticating...")
socket.emit("user joined", mynick, mycolor)

console.log("Setting message event handler...")
socket.on("message", function(data) {
	let is_me = data.nick == mynick && (data.home == myhome || myhome == "---")
	let is_system = data.home === "trollbox"
	let do_not_process = is_me || is_system
	if (do_not_process) return

	data.msg = he.decode(data.msg)
	let msg = data.msg.trim()
	let test_pref = msg.match(regex_pref)
	let test_devpref = msg.match(regex_devpref)
	let is_dev_command = false
	if (test_devpref) {
		is_dev_command = true
		msg = msg.slice(devpref.length)
	} else if (test_pref) {
		msg = msg.slice(pref.length)
	} else {
		return // it's not a command, ignore
	}
	let args = msg.split(" ")
	let duck = args.slice(1).join(" ")
	let command = args[0]
	// console.log("%o\n%o\n%o\n%o", msg, args, duck, command);shutdown()

	if (command == "unfreeze" && is_dev_command) {
		unfreeze()
	} else if (command == "freeze" && is_dev_command) {
		freeze()
	}

	if (frozen) return

	if (command == "help") {
		say(`\
**NW.js v0.5**

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
		let shorthand = args[1]
		let fn = userfiles + shorthand + ".txt"
		let contents = ""
		try {
			contents = fs.readFileSync(fn, { encoding: "utf8" })
		} catch(e) {
			if (e.code == "ENOENT") {
				say(`man there's literally no "${ args[1] }" file`)
			}
			console.log(e.toString())
		}
		say("File contents:\n" + contents)
	} else if (command == "save") {
		let shorthand = args[1]
		let fn = userfiles + shorthand + ".txt"

		if (!fs.existsSync(userfiles)) {
			fs.mkdirSync(userfiles)
		}

		let contents = args.splice(2).join(" ")
		try {
			fs.writeFileSync(fn, contents, { encoding: "utf8" })
		} catch(e) {
			if (e.code == "ENOENT") {
				say("this file couldn't be saved because it have either illegal symbols, or the file name is too long")
			}
			console.log(e.toString())
		}
		say(`file saved! use "+load ${ shorthand }" to read it!`)
	} else if (command == "userinfo") {
		if (duck != "") {
			let username = duck
			let homes_of_username = find_home(username)
			if (current_users[username]) {
				let msg = `Home has ${ current_users[username].length } name${ current_users[username].length > 1 ? "s" : "" } attached to it:`
				current_users[username].forEach(function(value, index) {
					msg += `\n ${ value[0] }, with the color of ${ value[1] }`
				})
				say(msg + `\n(And the perms of ${ level_to_privilege_name(privileges[homes_of_username]) })`)
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
				let result = vmrun(duck)
				say(`> ${ result }`)
			} catch (e) {
				say(`*${ e.toString() }*`)
			}
		} else {
			say(he.decode("&#10060; No admin permissions."))
		}
	} else if (command == "say") {
		if (duck == "") {
			say("Missing argument!")
			return "missing arg"
		}
		say(duck)
	} else if (command == "test") {
		if (duck == "") {
			say("Missing argument!")
			return "missing arg"
		}
		say(toBraile(duck))
	}
})

socket.on("update users", function(data) {
	current_users = {} // empty it
	Object.keys(data).forEach(key => {
		let value = data[key]
		let username = ""
		let home = ""
		let color = ""
		Object.keys(value).forEach(key => {
			let sub_value = he.decode(value[key])
			if (key == "nick") {
				username = sub_value
			} else if (key == "home") {
				home = sub_value
			} else if (key == "color") {
				color = sub_value
			}
		})
		if (home !== "trollbox")
			current_users[value] = [username, home, color]
	})
})

console.log("Listening to commands from now.")
