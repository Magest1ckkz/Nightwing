## Notes
* For `socket.io-client`: The bot will react to commands even if it is there as a logged user (before an "user joined" event). To react to a command, it will automatically "join" with the parameters set in the (last?) call of `socket.emit("user joined", ...)`, as they will be saved internally.
