const handleSendMessage = (text) => {
  socket.emit("sendMessage", text);
};

const messages = document.querySelector("#messages");
const messageTemplate = document.querySelector("#message-template").innerHTML;

socket.on("messages", (data) => {
  console.log("!!!!!!", data);
  // const html = Mustache.render(listTemplate, data);

  data.forEach((item) => {
    const html = Mustache.render(messageTemplate, {
      ...item,
      created_at: moment(item.created_at).format("h:mm a"),
    });
    messages.insertAdjacentHTML("beforeend", html);
  });
});
