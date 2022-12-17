/*
	Nightwing.js
	a Node bot for trollbox.party
	developed by Magestick, Dragsun, cryolazulite
	licensed under MIT License
*/

console.log("The starting process began.")

console.log("Setting functions and values...")

// import
const get_key_by_value = (object, value) => Object.keys(object).find(key => object[key] === value)
const escape_regex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
const swap_keys_and_values = (object) => Object.fromEntries(Object.entries(object).map(([key, value]) => [value, key]))
const strmap = (the_map, string) => string.split("").map(c => the_map[c]).join("")
const braille_map = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=".split("").reduce((o, n, i) => {
	return o[n] = "⠀⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊⠋⠌⠍⠎⠏⠐⠑⠒⠓⠔⠕⠖⠗⠘⠙⠚⠛⠜⠝⠞⠟⠠⠡⠢⠣⠤⠥⠦⠧⠨⠩⠪⠫⠬⠭⠮⠯⠰⠱⠲⠳⠴⠵⠶⠷⠸⠹⠺⠻⠼⠽⠾⠿"[i],
	       o[n.toLowerCase()] = o[n], o
}, {})
const inverse_braille_map = swap_keys_and_values(braille_map)
const to_braille = (string) => strmap(braille_map, string)
const from_braille = (string) => strmap(inverse_braille_map, string)

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

/*
const privilege_key = {
	"User"     : 1,
	"Moderator": 2,
	"Superuser": 3,
	"Owner"    : 4
}
*/

// probably could be done in one chain
let privilege_key = {}
let privilege_key_list = [
	"User",
	"Moderator",
	"Superuser",
	"Owner"
]
for (let i = 0; i < 4; i++) {
	privilege_key[privilege_key_list[i]] = i + 1
}
// -----------------------------------

const inverse_privilege_key = swap_keys_and_values(privilege_key)

/* - now this data is stored in privileges.json
let privileges = {
	"FFF38787JKDS3Z1E133CMEHDSMFF3M3F": privilege_key["Owner"], // Magestick
	"EF1ASZFZ1HH24AS3CE1FASZEEHECFFMH": privilege_key["Superuser"], // Anton
	"DS13387Z1EDSDS1ZASHDSDSE12EM2372": privilege_key["Superuser"],
	"EDS873CZCASH3FZH3Z187ASZ4M43Z1JK": privilege_key["Superuser"], // FidgetSpinzz
	"MASZM3CM7HMFZ3HFH21FFZ3JKFZ321DS": privilege_key["Superuser"], // cryolazulite
}
*/

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

const mynick = `Nightwing [${ pref }]`
const mycolor = "royalblue"

const regex_pref = new RegExp(`^${ escape_regex(pref) }\\w+`, "g")
const regex_devpref = new RegExp(`^${ escape_regex(devpref) }\\w+`, "g")

const lang = {
	"help": `\
**Nightwing.js version 0.5**
A versatile bot for trollbox.party.

${ pref }help - Show this message.
${ pref }about - Show the information about the system the bot is running on.
${ pref }say <message> - Say something!
${ pref }text2braille <text> - Convert ASCII text to Braille.
${ pref }braille2text <text> - Convert Braille to ASCII text.
${ pref }userinfo < "home" | "nick" | "id" > <appropriate data to search by> - User info, such as nickname, color, home, and local permissions.
${ pref }save <filename without whitespaces> <content> - Save a text file.
${ pref }load <filename without whitespaces> - Load a text file.
${ devpref }freeze **[SUPERUSER ONLY]** - Freeze bot (stop reacting to commands).
${ devpref }unfreeze **[SUPERUSER ONLY]** - Unfreeze bot (continue reacting to commands).
${ devpref }shutdown **[SUPERUSER ONLY]** - Shut down the bot.
${ devpref }evaljs **[SUPERUSER ONLY]** - Execute JavaScript.`,
	"low_rank": "\u274C You are not privileged enough to use this command.",
	"err_enoent_save": "This file couldn't be saved because its name have either illegal symbols, or the file name is too long.",
	"nothing_to_do": "Nothing to do.",
	"wrong_format": "Wrong format!",
	"missing_argument": "Missing argument!"
}

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
	let res = JSON.stringify(obj, null, "\t")
	let loaded_from_disk = null
	let need_to_compare = null
	try {
		loaded_from_disk = fs.readFileSync(fp)
		need_to_compare = true
	} catch(e) {
		need_to_compare = false
	}
	try {
		if (need_to_compare && res != loaded_from_disk) {
			// can overwrite previous file backups!
			fs.writeFileSync(fp + ".bak", loaded_from_disk)
			fs.writeFileSync(fp, res)
		}
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
		Object.entries(privileges).forEach(([key, value]) => {
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
		res = false
	}
	return res
}

function save_config() {
	let res = true
	Object.entries(privileges).forEach(([key, value]) => {
		privileges[key] = rank_to_privilege_name(value)
	})
	res = save_obj(path_privileges, privileges)
	res &= save_obj(path_blacklist, {"blacklist": blacklist})
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

function rank_to_privilege_name(level) {
	// return get_key_by_value(privilege_key, level)
	return inverse_privilege_key[level]
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
	    "\n• Permission level: " + rank_to_privilege_name(privileges[homes[0]]) // should display all of them, linked to homes
	)
}

function ban_user(home) {
	blacklist.push(home)
}

function unban_user(home) {
	blacklist.splice(blacklist.indexOf(home), 1)
}

function freeze() {
	frozen = true
	freeze_timeout_handler = setTimeout(() => {
		shutdown()
	}, 1 * 3600 * 1e3) // 1 hour
	say("+freeze \u2744\uFE0F")
	console.log("The bot is frozen now.")
}

function unfreeze() {
	if (frozen) {
		frozen = false
		clearTimeout(freeze_timeout_handler)
		say("Unfreezing... I can respond to commands again!")
		console.log("The bot responds to commands again.")
	} else {
		say(lang["nothing_to_do"])
	}
}

function shutdown() {
	console.log("Shutting down...")
	save_config()
	process.exit()
}

function find_home_by_nickname(username) {
	let found_homes = []
	Object.entries(current_users).forEach(([key, value]) => {
		if (value[0] == username)
			found_homes.push(key)
	})
	return found_homes
}

function say(message) {
	let first_delay = 700
	let second_delay = 450

	setTimeout(() => {
		socket.send(message)
		setTimeout(() => {
			socket.send("")
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

function vmrun(code) {
	let imported_readonly_globals = [
		"console",
		// "socket.emit", // has no effect
		// "socket.send", // has no effect
		// "say", // code `while (true) { say(...) }` leads to a real infinite loop
		// "os",
		// "fs"
	]
	let nevermind = new VM({
		timeout: 1e3,
		allowAsync: false // be aware of setTimeout in called functions
	})
	imported_readonly_globals.forEach(value => {
		eval(`nevermind.freeze(${ value }, "${ value.replaceAll('"', '\\"') }")`)
	})
	return nevermind.run(code)
}

function keyhandle() {
	let kbinfo = arguments[1]
	if (!kbinfo)
		return

	let key = kbinfo.name
	if (key == "s") // document this and similar features
		return shutdown()
}

function asciify(text) {
	text = text.replaceAll("\\", "\\\\").replaceAll("*", "\\*").replaceAll("_", "\\_").split("\n")
	let res = text
	res.forEach((line, index) => {
		res[index] = "\u200B" + line.trimEnd()
	})
	res = res.join("\n")
	return res
}

const say_ascii = (text) => say(asciify(text))

// main code, part 1. initialization.

// Load the system info

/*
	let gigabytes = 1024 ** 3
	let cpu_info = os.cpus()[0]["model"]
	let ram_info = Math.ceil(os.totalmem() / gigabytes)
	delete gigabytes
*/

// Placeholders
let cpu_info = "Intel(R) Core(TM) i3-540 CPU @ 3.06 GHz"
let ram_info = 4
// ------------

const system_info_string = `This bot is running on ${ cpu_info } with ${ ram_info } GB of RAM.`
delete cpu_info, ram_info

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
	let duck = args.slice(1).join(" ").replaceAll(/\<\/?strong\>/gim, "").replaceAll(/\<\/?em\>/gim, "")
	let command = args[0]
	let zero_arguments = duck.trim() === ""

	if (command == "unfreeze" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])
		unfreeze()
	}

	if (frozen) return

	if (command == "freeze" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])
		freeze()
	}

	if (command == "help") {
		say(lang["help"])
	} else if (command == "about") {
		say(system_info_string)
	} else if (command == "load") {
		let shorthand = args[1]
		if (shorthand.match(/\/dev\/(u)?random(\/)?/gim)) {
			let randbytes = ""
			for (let i = 0; i < 2**10; i++) {
				randbytes += String.fromCharCode(Math.floor(Math.random() * 256))
			}
			say(`File contents:\n${ randbytes }`)
			return
		}
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

		if (fs.existsSync(fn))
			return say("This file already exists!")

		let contents = args.slice(2).join(" ")
		try {
			fs.writeFileSync(fn, contents, { encoding: "utf8" })
		} catch(e) {
			if (e.code == "ENOENT") {
				say(lang["err_enoent_save"])
			}
			console.log(e.toString())
		}
		say(`File saved! Use "+load ${ shorthand }" to read it!`)
	} else if (command == "userinfo") {
		return say("W.I.P.") // remove this line if the work is done
		/* ================================================================== *
			Needs a refactor and adding the new features according to the
			specification in the "help" manual.
		* ================================================================== */
		if (zero_arguments)
			return form_userinfo(data.nick, data.color, data.home)

		let username = duck
		let homes_of_username = find_home_by_nickname(username)
		if (current_users[username]) {
			let msg = `Home has ${ current_users[username].length } name${ current_users[username].length > 1 ? "s" : "" } attached to it:`
			current_users[username].forEach(function(value, index) {
				msg += `\n ${ value[0] }, with the color of ${ value[1] }`
			})
			say(msg + `\n(And the perms of ${ rank_to_privilege_name(privileges[homes_of_username]) })`)
		} else {
			say("The specified user does not exist in the database.")
		}

		if (homes_of_username.length == 1) {
			let infos = current_users[homes_of_username[0]]
			form_userinfo(infos[0], infos[1], homes_of_username)
		} else if (homes_of_username.length > 1) {
			let colors = current_users[username][1]
			form_userinfo(username, colors, homes_of_username)
		}
	} else if (command == "evaljs" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])
		if (zero_arguments)
			return say(lang["wrong_format"])
		try {
			let result = vmrun(duck)
			say(`> ${ result }`)
		} catch (e) {
			say(`*${ e.toString() }*`)
		}
	} else if (command == "say") {
		if (zero_arguments) return say(lang["missing_argument"])
		say_ascii(duck)
	} else if (command == "text2braille") {
		if (zero_arguments) return say("Missing argument!")
		say(to_braille(duck))
	} else if (command == "braille2text") {
		if (zero_arguments) return say("Missing argument!")
		say_ascii(from_braille(duck))
	} else if (command == "shutdown") {
		shutdown()
	}
})

socket.on("update users", function(data) {
	current_users = {}
	Object.entries(data).forEach(([key, entry]) => {
		let username = ""
		let home = ""
		let color = ""
		Object.entries(entry).forEach(([key, value]) => {
			let res = he.decode(value)
			if (key == "nick") {
				username = res
			} else if (key == "home") {
				home = res
			} else if (key == "color") {
				color = res
			}
		})
		if (home !== "trollbox")
			current_users[username] = [username, home, color]
	})
})

socket.on("user joined", function(data) {
	let is_me = data.nick == mynick && (data.home == myhome || myhome == "---")
	let should_react = check_if_this_privilege_or_higher(data.home, "Moderator") && !is_me
	if (should_react) {
		let nickname = he.decode(data.nick)
		let horizontal_box_length = " Welcome back, ! ".length + nickname.length
		let ascii = `╔${ "═".repeat(horizontal_box_length) }╗\n`
		ascii += `║ Welcome back, ${ nickname }! ║\n`
		ascii += `╚${ "═".repeat(horizontal_box_length) }╝`
		say(ascii)
	}
})

console.log("Listening to commands from now.")
