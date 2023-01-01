/*
	Nightwing.js
	a Node bot for trollbox.party
	developed by Nightwing.js development team
	licensed under MIT License
*/

const __main__ = require.main === module

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
const { CensorSensor } = require("censor-sensor")
// const censor = new CensorSensor()
const Hjson = require("hjson")

// global declarations

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

let privileges = {}
let blacklist = []
let myhome = ""

const userfiles = "./PublicData/"
const path_privileges = "./privileges.hjson"
const path_blacklist = "./blacklist.hjson"
const path_banned_words = "./banned_words.hjson"

let freeze_timeout_handler = false
let frozen = false

let current_users = {}

const pref = "+"
const devpref = "+/"

const mynick = `Nightwing [${ pref }]`
const mycolor = "royalblue"

const regex_pref = new RegExp(`^${ escape_regex(pref) }\\w+`, "g")
const regex_devpref = new RegExp(`^${ escape_regex(devpref) }\\w+`, "g")

let do_not_check_connection = false
let do_not_parse_messages = false

const lang = {
	"done": "Done.",
	"failed": "Failed!",
	"help": `\
**Nightwing.js version 0.5.2**
A versatile bot for trollbox.party.

${ pref }help - Show this message.
${ pref }about - Show the information about the system the bot is running on.
${ pref }say <message> - Say something!
${ pref }text2braille <text> - Convert ASCII text to Braille.
${ pref }braille2text <text> - Convert Braille to ASCII text.
${ pref }userinfo < "home" | "nick" | "id" > <appropriate data to search by> - User info, such as username, color, home, and local permissions.
${ pref }save <filename without whitespaces> <content> - Save a text file.
${ pref }add <filename without whitespaces> <content> - Append to a text file.
${ pref }load <filename without whitespaces> - Load a text file.

**Superuser and higher only commands**
${ devpref }uptime - Show the uptime information
${ devpref }freeze - Freeze bot (stop reacting to commands).
${ devpref }unfreeze - Unfreeze bot (continue reacting to commands).
${ devpref }ban <home> - Ban a user
${ devpref }unban <home> - Unban a user
${ devpref }shutdown - Shut down the bot.
${ devpref }evaljs - Execute JavaScript.`,
	"low_rank": "\u274C You are not privileged enough to use this command.",
	"err_enoent_save": "This file couldn't be saved because its name have either illegal symbols, or the file name is too long.",
	"nothing_to_do": "Nothing to do.",
	"wrong_format": "Wrong format!",
	"missing_argument": "Missing argument!",
	"loading_config": "Loading configurations...",
	"saving_config": "Saving configurations...",
	"warn_profane": "At least 1 profane word has been detected in the arguments.",
	"access_denied_profane": he.decode("&#128248;&#9989; Caught you in 4k120fps")
}

// procedures
const is_home = (str) => str.match(/[A-Z0-9]{32}/)
const timestamp = () => +new Date() / 1e3 | 0
const pad_num = num => num.toString().padStart(2, "0")
const remove_tags = (str) => str.replaceAll(/\<\/?[a-z]+\>/gim, "")

function load_obj(fp, options = "") {
	try {
		let loaded = fs.readFileSync(fp).toString()
		if (options.includes("list"))
			return Hjson.parse(loaded)
		return Hjson.rt.parse(loaded)
	} catch(e) {
		// case 1: cannot access file or it does not exists
		// case 2: bad JSON
		if (e.code == "ENOENT" || e.toString().includes("in JSON"))
			return false
	}
}

function save_obj(fp, obj, options = "") {
	let res = ""
	if (options.includes("list")) {
		res = Hjson.stringify(obj, { quotes: "all", space: "\t" })
	} else {
		res = Hjson.rt.stringify(obj, { quotes: "all", space: "\t" })
	}
	let loaded_from_disk = null
	let need_to_compare = null
	try {
		loaded_from_disk = fs.existsSync(fp) && fs.readFileSync(fp)
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
			if (is_home(key))
				privileges[key] = privilege_key[value]
		})
		myhome = Object.keys(privileges)[0]
		console.log("Loaded privileges information successfully.")
	} else if (loaded === false) {
		privileges = {}
		myhome = "---"
		res = false
		console.log("Failed to load privileges information!")
	}

	loaded = load_obj(path_blacklist, "list")
	if (typeof loaded === "object") {
		blacklist = loaded["blacklist"] // a list
		console.log("Loaded blacklist successfully.")
	}

	/*
	loaded = load_obj(path_banned_words)
	if (typeof loaded === "object") {
		loaded["banned_words"].forEach(value => {
			censor.addWord(value)
		})
		console.log("Loaded banned words list successfully.")
	}
	*/

	return res
}

function save_config() {
	let res = true
	Object.entries(privileges).map(([key, value]) => {
		if (key.match(/[A-Z0-9]{32}/))
			privileges[key] = inverse_privilege_key[value]
	})
	res = save_obj(path_privileges, privileges)
	res = res && save_obj(path_blacklist, { "blacklist": blacklist }, "list")
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

function form_userinfo(name, colors, homes) {
	if (typeof colors === "string")
		colors = [colors]
	if (typeof homes === "string")
		homes = [homes]
	say(
		  "• Name: " + he.decode(name) +
	    `\n• Color${ (colors.length > 1) ? "s" : "" }: ` + colors.join(", ") +
	    `\n• Home${ (homes.length > 1) ? "s" : "" }: ` + homes.join(", ") +
	    "\n• Permission level: " + inverse_privilege_key[privileges[homes[0]]] // should display all of them, linked to homes
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

	console.log(lang["saving_config"])
	save_config()

	process.exit()
}

function find_home_by_username(username) {
	let found_homes = []
	Object.entries(current_users).forEach(([key, value]) => {
		if (value[0] == username)
			found_homes.push(key)
	})
	return found_homes
}

function say(message) {
	// let first_delay = 700
	// let second_delay = 450
	let first_delay = second_delay = 365

	setTimeout(() => {
		socket.send(message)
		setTimeout(() => {
			socket.send("")
		}, first_delay + second_delay)
	}, first_delay)
}

function check_connection() {
	if (do_not_check_connection)
		return

	if (socket.connected === false) {
		console.log("Server connection lost, reconnecting in 3 seconds...")
		socket.disconnect()
		setTimeout(() => socket.connect(), 3e3)
	}
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
	// not `while (true)` safe anymore
	let imported_readonly_globals = [
		"console",
		// "censor",
		"socket",
		"say",
		"os",
		"fs"
	]
	let nevermind = new VM({
		timeout: 1e3,
		// sandbox: form_keyequal(imported_readonly_globals),
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

	if (key == "s") { // document this and similar features
		return shutdown()
	} else if (key == "u") { // document this and similar features
		console.log(lang["loading_config"])
		let res = load_config()
		if (res === true) {
			console.log(lang["done"])
		} else {
			console.log(lang["failed"])
		}
		return
	} else if (key == "i" && kbinfo.shift) { // document this and similar features
		console.log(lang["saving_config"])
		let res = save_config()
		if (res === true) {
			console.log(lang["done"])
		} else {
			console.log(lang["failed"])
		}
		return
	}
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

function format_time(t) {
	let days = Math.floor(t / 86400)
	let as_date = new Date(t)
	let hours = pad_num(as_date.getHours())
	let minutes = pad_num(as_date.getMinutes())
	let seconds = pad_num(as_date.getSeconds())
	let res = `${ days }:${ hours }:${ minutes }:${ seconds }`
	return res
}

const say_ascii = (text) => say(asciify(text))

// main code, part 1. initialization.

// censor.setCleanFunction((str) => Array.from(str, x => ".").join(""))
const start_time = timestamp()

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

console.log(lang["loading_config"])
load_config()

// main code, part 2. event handlers.

function parse_message(data) {
	if (do_not_parse_messages)
		return

	let is_me = data.nick == mynick && (data.home == myhome || myhome == "---")
	let is_system = data.home === "trollbox"
	let is_blocked = blacklist.includes(data.home)
	let do_not_process = is_me || is_system || is_blocked

	if (data.home == "trollbox" && data.msg.match(/you have exceeded the maximum/gim)) {
		console.log("trollbox.party: " + he.decode(data.msg))
		socket.disconnect()
		do_not_check_connection = true
		do_not_parse_messages = true
		setTimeout(() => {
			socket.connect()
			do_not_parse_messages = true
			setTimeout(() => {
				do_not_check_connection = false
			}, 3e3)
		})
	}

	if (do_not_process) return

	data.msg = remove_tags(he.decode(data.msg))
	let msg = data.msg
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

	if (command == "help" && !is_dev_command) {
		say(lang["help"])
	} else if (command == "about" && !is_dev_command) {
		say(system_info_string)
	} else if (command == "uptime" && is_dev_command) {
		let os_uptime = format_time(os.uptime())
		let bot_uptime = format_time(timestamp() - start_time)
		say(`OS uptime: ${ os_uptime }\nBot uptime: ${ bot_uptime }`)
	} else if (command == "load" && !is_dev_command) {
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
	} else if ((command == "save" || command == "add") && !is_dev_command) {
		let shorthand = args[1]
		let contents = args.slice(2).join(" ")

		if (contents.trim() === "") {
			return say("The file is not saved because no content was specified.")
		} else if (false && (censor.isProfaneIsh(shorthand) || censor.isProfaneIsh(contents))) {
			console.log(lang["warn_profane"])
			say(lang["access_denied_profane"])
			return
		} else if (shorthand.length > 256 - ".txt".length) {
			return say("The file name is too long!")
		} else if (!shorthand.match(/^[a-z0-9!#$%&'()+,.=@\[\] ^_`{}~-]*$/i)) {
			return say("Illegal characters detected.")
		}

		let fn = userfiles + shorthand + ".txt"

		if (!fs.existsSync(userfiles)) {
			fs.mkdirSync(userfiles)
		}

		let can_overwrite = check_if_this_privilege_or_higher(data.home, "Moderator")

		/*
		if (fs.existsSync(fn) && !can_overwrite)
			return say("This file already exists!")
		*/

		let file_exists = fs.existsSync(fn)
		try {
			if (command == "save" && (can_overwrite || !file_exists)) {
				if (file_exists)
					console.log("Overwriting that file...")
				fs.writeFileSync(fn, contents, { encoding: "utf8" })
			} else if (command == "add" || command == "save") {
				if (file_exists)
					contents = "\n" + contents
				fs.appendFileSync(fn, contents, { encoding: "utf8" })
			}
			console.log("Saved file: %s", fn)
		} catch(e) {
			if (e.code == "ENOENT") {
				say(lang["err_enoent_save"])
			} else if (e.code == "EPERM") {
				say(`This file is marked as read-only. Unable to save with the file name **${ shorthand }**.`)
			}
			console.log(e.toString())
		}
		if (fs.existsSync(fn)) {
			say(`File saved! Use "+load ${ shorthand }" to read it!`)
		} else {
			say("An internal error occurred. Please tell the owner to check logs.")
		}
	} else if (command == "userinfo" && !is_dev_command) {
		// return say("W.I.P.") // remove this line if the work is done
		/* ================================================================== *
			Needs a refactor and adding the new features according to the
			specification in the "help" manual.
		* ================================================================== */
		if (zero_arguments)
			return form_userinfo(data.nick, data.color, data.home)

		let search_mode = args[0]
		if (search_mode == "home" && is_home(args[1])) {
			let homes_of_username = args[1]
		} else if (search_mode == "nick") {
			let username = args[1]
			let homes_of_username = find_home_by_username(username)
		} else if (search_mode == "id") {
			return say("W.I.P.")
		} else {
			return say(lang["wrong_format"])
		}

		if (current_users[username]) {
			let msg = `Home has ${ current_users[username].length } name${ current_users[username].length > 1 ? "s" : "" } attached to it:`
			current_users[username].forEach(function(value, index) {
				msg += `\n ${ value[0] }, with the color of ${ value[1] }`
			})
			say(msg + `\n(And the perms of ${ inverse_privilege_key[privileges[homes_of_username]] })`)
		} else if (search_mode == "nick") {
			if (blacklist[spec_home]) {
				let msg = `This home is blocked from using this bot.`
				say(msg)
			} else if (homes_of_username.some(value => blacklist.includes(spec_home))) {

			} else {
				say("The specified user does not exist in the database.")
			}
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
	} else if (command == "say" && !is_dev_command) {
		if (zero_arguments)
			return say(lang["missing_argument"])

		/*
		if (censor.isProfane(duck))
			console.log(lang["warn_profane"])
		*/

		// say(censor.cleanProfanity(duck))
		say(duck)
	} else if (command == "text2braille" && !is_dev_command) {
		if (zero_arguments) return say("Missing argument!")
		say(to_braille(duck))
	} else if (command == "braille2text" && !is_dev_command) {
		if (zero_arguments) return say("Missing argument!")
		say(from_braille(duck))
	} else if (command == "shutdown" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])

		shutdown()
	} else if (command == "ban") {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])

		if (!blacklist.includes(duck)) {
			ban_user(duck)
			say("Banned the user.")
		} else [
			say("The user is already banned.")
		]
	} else if (command == "unban") {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])

		if (blacklist.includes(duck)) {
			unban_user(duck)
			say("Unbanned the user.")
		} else {
			say(lang["nothing_to_do"])
		}
	}
}

function parse_users(data) {
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
}

function on_user_joined_event(data) {
	let is_me = data.nick == mynick && (data.home == myhome || myhome == "---")
	let should_greet = check_if_this_privilege_or_higher(data.home, "Moderator") && !is_me
	if (should_greet) {
		let username = he.decode(data.nick)
		let horizontal_box_length = " Welcome back, ! ".length + username.length
		let ascii = `╔${ "═".repeat(horizontal_box_length) }╗\n`
		ascii += `║ Welcome back, ${ username }! ║\n`
		ascii += `╚${ "═".repeat(horizontal_box_length) }╝`
		say(ascii)
	}
}

if (__main__) {
	console.log("Setting keyboard event handler...")
	keypress(process.stdin)
	process.stdin.on("keypress", keyhandle)
	process.stdin.setRawMode(true)
	process.stdin.resume()

	console.log("Authenticating...")
	socket.emit("user joined", mynick, mycolor)

	console.log("Setting message event handler...")

	socket.on("message", parse_message)
	socket.on("update users", parse_users)
	socket.on("user joined", on_user_joined_event)
	setInterval(() => check_connection(), 3e3)

	console.log("Listening to commands from now.")
}
