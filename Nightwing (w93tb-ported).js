/*
	Nightwing.js
	a Node bot for trollbox.party
	developed by Nightwing.js development team
	licensed under MIT License
*/

"use strict"

const __main__ = require.main === module
const OFFLINE_MODE = false
const TEST_MODE = false
const LIVE_MODE = false

console.log("The starting process began.")

console.log("Setting functions and values...")

// import
const get_key_by_value = (object, value) => Object.keys(object).find(key => object[key] === value)
const escape_regex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // $& means the whole matched string
const swap_keys_and_values = (object) => Object.fromEntries(Object.entries(object).map(([key, value]) => [value, key]))
const strmap = (the_map, string) => string.split("").map(c => the_map[c]).join("")
let braille_alphabet = Array.from({ length: 0x283f - 0x2800 }, (_, i) => String.fromCharCode("\u2800".charCodeAt(0) + i))
const braille_map = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=".split("").reduce((o, n, i) => {
	return o[n] = braille_alphabet[i],
	       o[n.toLowerCase()] = o[n], o
}, {})
braille_alphabet = null
const inverse_braille_map = swap_keys_and_values(braille_map)
const to_braille = (string) => strmap(braille_map, string)
const from_braille = (string) => strmap(inverse_braille_map, string)

// node.js includes
const io = require("socket.io-client")

let socket = class {}
if (!OFFLINE_MODE) {
  socket = io("https://www.windows93.net:8086", {
		forceNew: true,
	transportOptions: {
		polling: {
			extraHeaders: {
				"Accept": "*/*",
				"Accept-Encoding": "identity",
				"Accept-Language": "*",
				"Cache-Control": "no-cache",
				"Connection": "keep-alive",
				"Cookie": "",
				"Host": "www.windows93.net",
				"Origin": "http://www.windows93.net",
				"Pragma": "no-cache",
				"Referer": 'http://www.windows93.net/trollbox/index.php',
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36"
			}
		}
	}
	})
} else {
	socket.connected = true
	socket.connect = function() {}
	socket.disconnect = function() {}
	socket.destroy = function() {}
	socket.emit = function() {}
}

const he = require("he")
// const keypress = require("keypress")
const readline = require("readline")
const os = require("os")
const path = require("path")

const real_fs = require("fs")
const mem_fs = require("memfs")
let fs = class {}
let fs_mode = "real_fs"

const replaceAll = require("string.prototype.replaceall")
replaceAll.shim()

const { VM } = require("vm2")
const { CensorSensor } = require("censor-sensor")
const censor = new CensorSensor()
const Hjson = require("hjson")
const removeMd = require("remove-markdown")

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

const userfiles = "PublicData/"
const path_privileges = "privileges.hjson"
const path_blacklist = "blacklist.hjson"
const path_banned_words = "banned_words.hjson"

let freeze_timeout_handler = false
let frozen = false

let current_users = {}

const pref = "+"
const devpref = "+/"

const mynick = `Nyfelnix [${ pref }]`
const mycolor = "royalblue"

const regex_pref = new RegExp(`^${ escape_regex(pref) }\\w+`, "g")
const regex_devpref = new RegExp(`^${ escape_regex(devpref) }\\w+`, "g")

let do_not_check_connection = false
let do_not_parse_messages = false

const version_info_string = `Nyfelnix version 0.5.3`
let additional_version_info_string = "Modes enabled: "
let running_options = []
if (OFFLINE_MODE)
	running_options.push("offline")
if (TEST_MODE)
	running_options.push("test")
if (LIVE_MODE)
	running_options.push("live")
if (running_options.length == 0) {
	additional_version_info_string += "None"
} else {
	additional_version_info_string += running_options.join(", ")
}

const lang = {
	"done": "Done.",
	"failed": "Failed!",
	"help": `\
**${ version_info_string }**
A versatile bot for trollbox.party.

${ pref }help - Show this message.
${ pref }about - Show the information about the system the bot is running on.
${ pref }say <message> - Say something!
${ pref }text2braille <text> - Convert ASCII text to Braille.
${ pref }braille2text <text> - Convert Braille to ASCII text.
(W.I.P.) ${ pref }userinfo < "home" | "nick" | "id" > <appropriate data to search by> - User info, such as username, color, home, and local permissions.
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
	"access_denied_profane": he.decode("&#128248;&#9989; Caught you in 4k120fps"),
	"err_internal": "An internal error occurred. Please tell the owner to check logs."
}

const textfile_bool_properties = ["read-only", "fs-time"]

// procedures
const is_home = (str) => str.match(/^[A-Z0-9]{32,32}$/)
const timestamp = () => Math.floor(+new Date() / 1e3)
const pad_num = num => num.toString().padStart(2, "0")
const is_extended_textfile = (data) => data.match(/^NW\//) && data.match(/\x00\n/)
const set_file_metadata = (content, metadata) => form_file_metadata(metadata) + content
const get_file_content = (data) => data.split("\u0000\n").slice(1).join("\u0000\n")
const prepare_message_text = (str) => he.decode(str.replaceAll(/\<\/?[a-z]+\>/gim, ""))
//~ const clean_output_markdown = (text) => text.replaceAll(/(?<!\\)(\*|_|~~)/g, "").replaceAll("\\\\", "\\")
const clean_output_markdown = (text) => he.decode(removeMd(he.encode(text)))
const clean_dir_path = path => path.split("/").filter(entry => entry != "").join("/")

if (OFFLINE_MODE) {
	socket.send = function(message) {
		console.log("%s", clean_output_markdown(message))
	}
}

function load_obj(fp, options = "") {
	if (LIVE_MODE && real_fs == null)
		return false

	try {
		let loaded = ""
		loaded = fs.readFileSync(fp, { encoding: "utf8" })
		if (options.includes("list"))
			return Hjson.parse(loaded)
		return Hjson.rt.parse(loaded)
	} catch(e) {
		// case 1: cannot access file or it does not exist
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
	let need_to_compare = false
	if (fs.existsSync(fp)) {
		loaded_from_disk = fs.readFileSync(fp, { encoding: "utf8" })
		need_to_compare = true
	}

	try {
		if (need_to_compare && res != loaded_from_disk) {
			// can overwrite previous file backups!
			fs.writeFileSync(fp + ".bak", loaded_from_disk, { encoding: "utf8" })
			fs.writeFileSync(fp, res, { encoding: "utf8" })
		}
		return true
	} catch(e) {
		// not much to handle
		return false
	}
}

function load_config() {
	let res = true

	if (LIVE_MODE && fs_mode == "memfs")
		return res

	console.log(lang["loading_config"])

	let loaded = load_obj(path_privileges)
	if (typeof loaded === "object" && !OFFLINE_MODE) {
		privileges = loaded
		Object.entries(privileges).forEach(([key, value]) => {
			if (is_home(key))
				privileges[key] = privilege_key[value]
		})
		myhome = Object.keys(privileges)[0]
		console.log("Loaded privileges information successfully.")
	} else if (loaded === false) {
		privileges = {}
		myhome = "#"
		res = false
		console.log("Failed to load privileges information!")
	}

	loaded = load_obj(path_blacklist, "list")
	if (typeof loaded === "object") {
		blacklist = loaded["blacklist"] // a list
		console.log("Loaded blacklist successfully.")
	}

	loaded = load_obj(path_banned_words, "list")
	if (typeof loaded === "object") {
		censor.customDictionary = {}
		loaded["banned_words"].forEach(value => {
			censor.customDictionary[value] = 5
		})
		console.log("Loaded banned words and applied successfully.")
	}

	return res
}

function save_config() {
	if (LIVE_MODE)
		return true

	console.log(lang["saving_config"])

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
	if (OFFLINE_MODE)
		return true

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
	let first_delay, second_delay = 0
	if (!OFFLINE_MODE)
		first_delay = second_delay = 365

	setTimeout(() => {
		socket.send(message)
		if (!OFFLINE_MODE)
			setTimeout(() => socket.send(""), second_delay)
	}, first_delay)
}

function check_connection() {
	if (do_not_check_connection)
		return

	if (!socket.connected) {
		do_not_check_connection = true
		console.log("Server connection lost, reconnecting in 3 seconds...")
		socket.disconnect()
		setTimeout(() => {
			socket.connect()
			setTimeout(() => {
				console.log("Authenticating...")
				socket.emit("user joined", mynick, mycolor)
			}, 375)
			do_not_check_connection = false
		}, 3e3)
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
		"censor",
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

function keyhandle(line) {
	line = line.trim()

	if (line == "")
		return

	if (line.match(/^c(onf(ig)?)? s(ave)?$/i)) { // document this and similar features
		let res = save_config()
		if (res === true) {
			console.log(lang["done"])
		} else {
			console.log(lang["failed"])
		}
	} else if (line.match(/^c(onf(ig)?)? (u(pdate)?|r(eload|l))$/i)) { // document this and similar features
		let res = load_config()
		if (res === true) {
			console.log(lang["done"])
		} else {
			console.log(lang["failed"])
		}
	} else if (line.match(/^(say|send) /i)) {
		let msg = line.trim().split(" ").splice(1).join(" ")
		socket.send(msg)
		console.log("Sent the message from the prompt!")
	} else if (line.match(/^(s(top)?|q(uit)?|exit)$/i)) { // document this and similar features
		shutdown()
	} else {
		// internal command parse
		parse_message({
			"nick": "Owner",
			"home": "",
			"color": "",
			"msg": line
		})
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

const say_ascii = (text) => say(asciify(text))

function format_time(t) {
	let days = Math.floor(t / 86400)
	let as_date = new Date(t)
	let hours = pad_num(as_date.getHours())
	let minutes = pad_num(as_date.getMinutes())
	let seconds = pad_num(as_date.getSeconds())
	let res = `${ days }:${ hours }:${ minutes }:${ seconds }`
	return res
}

function copy_dir_to_memfs(source_directory, target_directory) {
	source_directory = clean_dir_path(source_directory)
	target_directory = clean_dir_path(target_directory)

	console.log("Copying %s/*.* to memfs/%s...", source_directory, target_directory)

	if (!mem_fs.existsSync(target_directory))
		mem_fs.mkdirSync(target_directory, { recursive: true })

	Object.entries(real_fs.readdirSync(source_directory)).forEach(([key, fn]) => {
		let from_path = path.join(source_directory, fn)
		let to_path = path.join(target_directory, fn)
		let loaded = real_fs.readFileSync(from_path)
		mem_fs.writeFileSync(to_path, loaded)
	})
}

function save_textfile(filepath, content, overwrite, metadata = {}) {
	if (overwrite && metadata["read-only"]) {
		fs.writeFileSync(filepath, set_file_metadata(content, metadata), { encoding: "utf8" })
	} else {
		if (fs.existsSync(filepath)) {
			let loaded = fs.readFileSync(filepath, { encoding: "utf8" })
			let old_metadata = get_file_metadata(loaded)
			let old_content = get_file_content(loaded)
			if (old_metadata["read-only"])
				throw "READ_ONLY"
			if (old_metadata["fs-time"])
				delete content["last-modified"]
			content = old_content + "\n" + content
		}
		let res = set_file_metadata(content, metadata)
		fs.writeFileSync(filepath, res, { encoding: "utf8" })
	}
}

function load_textfile(filepath) {
	if (!fs.existsSync(filepath))
		return false

	let loaded = fs.readFileSync(filepath, { encoding: "utf8" })

	let metadata = {}
	let load_metadata = get_file_metadata(loaded)
	if (typeof load_metadata === "object")
		metadata = load_metadata

	let data = loaded
	if (is_extended_textfile(data)) {
		data = get_file_content(data)
		console.log("Reading an extended text file.")
	} else {
		console.log("Reading a plain text file.")
		metadata = false
	}

	return [metadata, data]
}

function form_file_metadata(metadata) {
	if (!metadata["read-only"])
		delete metadata["read-only"]
	if (!metadata["fs-time"])
		delete metadata["fs-time"]

	let generated = "NW/"
	generated += JSON.stringify(metadata).replaceAll(/[ \t\n{}"']/g, "")
		.replaceAll(",", ";").replaceAll("true", "1").replaceAll("false", "0")
	generated += "\u0000\n"
	return generated
}

function get_file_metadata(data) {
	let obj = {
		"read-only": false,
		"fs-time": false
	}

	if (!is_extended_textfile(data))
		return false // it's not an extended text file

	data = data.slice("NW/".length).split("\u0000\n")[0].replaceAll(" ", "")
		.split(";")
	data.forEach(function(property) {
		var tup = property.split(":")
		if (textfile_bool_properties.includes(tup[1]) && tup[1].match(/[01]{1,1}/)) {
			tup[1] = !!+tup[1]
		} else if (tup[0] == "last-modified") {
			tup[1] = +tup[1]
		}
		obj[tup[0]] = tup[1]
	})

	return obj
}

// main code, part 1. initialization.

fs = real_fs
if (LIVE_MODE) {
	load_config()
	fs = mem_fs
	fs_mode = "memfs"
	copy_dir_to_memfs(userfiles, "PublicData")
}

if (!fs.existsSync(userfiles))
	fs.mkdirSync(userfiles, { recursive: true })

censor.disableTier(1)
censor.disableTier(2)
censor.setCleanFunction((str) => Array.from(str, x => ".").join(""))

const start_time = timestamp()

// Load the system info

/*
	let gigabytes = 1024 ** 3
	let cpu_info = os.cpus()[0]["model"]
	let ram_info = Math.ceil(os.totalmem() / gigabytes)
	gigabytes = null
*/

// Placeholders
let cpu_info = "Intel(R) Core(TM) i3-540 CPU @ 3.06 GHz"
let ram_info = 4
// ------------

const system_info_string = `This bot is running on ${ cpu_info } with ${ ram_info } GB of RAM.`
cpu_info = ram_info = null

if (!LIVE_MODE)
	load_config()

// main code, part 2. event handlers.

function parse_message(data) {
	if (do_not_parse_messages) return

	let is_me = data.nick == mynick && (data.home == myhome || myhome == "#")
	is_me = !OFFLINE_MODE && is_me
	let is_system = data.home === "trollbox"
	let is_blocked = blacklist.includes(data.home)
	let is_allowed_for_tests = TEST_MODE && !check_if_this_privilege_or_higher(data.home, "Superuser")
	let do_not_process = is_me || is_system || is_blocked || is_allowed_for_tests

	if (data.home == "trollbox" &&
		data.msg.match(/you have exceeded the maximum/gim))
	{
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

	data.msg = prepare_message_text(data.msg)
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

	if (command == "help") {
		say(lang["help"])
	} else if (command == "about") {
		say(system_info_string)
	} else if (command == "version") {
		say(version_info_string + "\n" + additional_version_info_string)
	} else if (command == "uptime") {
		let os_uptime = format_time(os.uptime())
		let bot_uptime = format_time(timestamp() - start_time)
		say(`OS uptime: ${ os_uptime }\nBot uptime: ${ bot_uptime }`)
	} else if (command == "load") {
		let shorthand = args[1]
		if (shorthand.match(/\/dev\/(u)?random(\/)?/gim)) {
			let randbytes = ""
			for (let i = 0; i < 2 ** 10; i++) {
				randbytes += String.fromCharCode(Math.floor(Math.random() * 256))
			}
			say(`File contents:\n${ randbytes }`)
			return
		}
		let fn = userfiles + shorthand + ".txt"

		if (!fs.existsSync(fn))
			return say(`man there's literally no "${ shorthand }" file`)

		try {
			let [metadata, contents] = load_textfile(fn)
			let attribute_str = ["[ ] Read-only", "[ ] Using FS time information"]
			if (LIVE_MODE)
				// attribute_str = attribute_str.slice(1)
				attribute_str.shift()
			let extended_textfile_props = ""
			if (typeof metadata === "object") {
				let fs_attribute_readonly = false
				try {
					fs.accessSync(fn, fs.constants.W_OK)
				} catch(e) {
					if (e.name != "TypeError") {
						fs_attribute_readonly = true
					}
				}

				if (metadata["read-only"] || fs_attribute_readonly)
					attribute_str[0] = "[X] Read-only"

				if (metadata["fs-time"])
					attribute_str[1] = "[X] Use FS time information"
				attribute_str = attribute_str.join(" | ")

				let mtime = 0
				if (metadata["fs-time"]) {
					mtime = fs.statSync(fn).mtime
				} else {
					mtime = metadata["last-modified"]
				}

				let date_str = ""
				date_str = new Date(mtime).toISOString()
				date_str = date_str.replace("T", " ").slice(0, -5) // ease of human reading

				extended_textfile_props = `Attributes: ${ attribute_str }\nLast modified: ${ date_str }\n`
			}
			let res = `File name: ${ shorthand }\n${ extended_textfile_props }Contents:\n${ contents }`
			say(res)
		} catch(e) {
			//~ console.log(e.toString())
			console.log(e)
			say(lang["err_internal"])
		}
	} else if (command == "save" || command == "add") {
		let shorthand = args[1]
		let contents = args.slice(2).join(" ")

		if (contents === "") {
			return say("The file is not saved because no content was specified.")
		} else if (false && (censor.isProfaneIsh(shorthand) || censor.isProfaneIsh(contents))) {
			console.log(lang["warn_profane"])
			return say(lang["access_denied_profane"])
		} else if (shorthand.length > 256 - ".txt".length) {
			return say("The file name is too long!")
		} else if (!shorthand.match(/^[a-z0-9!#$%&'()+,.=@\[\] ^_`{}~-]*$/i)) {
			return say("Illegal characters detected.")
		}

		let fn = userfiles + shorthand + ".txt"

		let file_exists = fs.existsSync(fn)
		let can_overwrite = check_if_this_privilege_or_higher(data.home, "Moderator")
		let metadata = {
			"read-only": false,
			"fs-time": false,
			"last-modified": Date.now()
		}

		if (file_exists) {
			metadata = get_file_metadata(fs.readFileSync(fn, { encoding: "utf8" }))
			if (typeof metadata === "object") {
				can_overwrite = can_overwrite && !metadata["read-only"]
				if (!can_overwrite)
					return say(`This file is marked as read-only (metadata). Unable to save with the file name **${ shorthand }**.`)
			}
		}

		try {
			fs.accessSync(fn, fs.constants.W_OK)
		} catch(e) {
			if (e.code == "EPERM") {
				say(`This file is marked as read-only (FS attribute). Unable to save with the file name **${ shorthand }**.`)
				return
			}
		}

		try {
			if (command == "save" && (can_overwrite || !file_exists)) {
				if (file_exists && metadata["read-only"] == false)
					console.log("Overwriting that file...")

				save_textfile(fn, contents, true, metadata)
			} else if (command == "add" || command == "save") {
				if (file_exists)
					contents = "\n" + contents
				fs.appendFileSync(fn, contents, { encoding: "utf8" })
			}
			console.log("Saved file: %s", fn)
		} catch(e) {
			if (e.code == "ENOENT") {
				say(lang["err_enoent_save"])
			} else {
				console.log(e.toString())
				say(lang["err_internal"])
			}
		}
		say(`File saved! Use "${ pref }load ${ shorthand }" to read it!`)
	} else if (false && command == "userinfo") {
		return say("W.I.P.") // remove this line if the work is done
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
	} else if (command == "say") {
		if (zero_arguments)
			return say(lang["missing_argument"])

		/*
		if (censor.isProfane(duck))
			console.log(lang["warn_profane"])
		*/

		// say(censor.cleanProfanity(duck))
		say(duck)
	} else if (command == "text2braille") {
		if (zero_arguments) return say("Missing argument!")
		say(to_braille(duck))
	} else if (command == "braille2text") {
		if (zero_arguments) return say("Missing argument!")
		say(from_braille(duck))
	} else if (command == "shutdown" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])

		console.log("Command issued: shutdown")
		shutdown()
	} else if (command == "ban" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])

		if (!is_home(duck))
			return say(lang["wrong_format"])

		if (!blacklist.includes(duck)) {
			ban_user(duck)
			say("Banned the user.")
		} else [
			say("The user is already banned.")
		]
	} else if (command == "unban" && is_dev_command) {
		if (!check_if_this_privilege_or_higher(data.home, "Superuser"))
			return say(lang["low_rank"])

		if (!is_home(duck))
			return say(lang["wrong_format"])

		if (blacklist.includes(duck)) {
			unban_user(duck)
			say("Unbanned the user.")
		} else {
			say(lang["nothing_to_do"])
		}
	}
}

// function parse_users(data) {
//	current_users = {}
//	Object.entries(data).forEach(([key, entry]) => {
//		let username = ""
//		let home = ""
//		let color = ""
//		Object.entries(entry).forEach(([key, value]) => {
//			let res = he.decode(value)
//			if (key == "nick") {
//				username = res
//			} else if (key == "home") {
//				home = res
//			} else if (key == "color") {
//				color = res
//			}
//		})
//		if (home !== "trollbox")
//			current_users[username] = [username, home, color]
//	})
// }


if (__main__) {
	console.log("Setting keyboard event handler...")

	const rli = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	rli.on("line", (content) => {
say(content);
});
	rli.on("close", shutdown)

	if (!OFFLINE_MODE) {
		console.log("Authenticating...")
		socket.emit("user joined", mynick, mycolor, "", "")

		console.log("Setting socket.io event handlers...")
		socket.on("message", parse_message)
		socket.on("connect", () => console.log("Listening to commands from now."))
		setInterval(check_connection, 3e3)
	}
}
