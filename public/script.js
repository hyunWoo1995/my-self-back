const socket = io();

socket.on("message", (id) => {
  console.log("sdfmksdfs id:: ", id);

  socket.emit("join", { code: "A02", user: { name: "이현우" } });
});

const lists = document.querySelector("#lists");
const listTemplate = document.querySelector("#list-template").innerHTML;
socket.on("list", (data) => {
  console.log("dat1111a", data);
  // const html = Mustache.render(listTemplate, data);

  data.forEach((item) => {
    const html = Mustache.render(listTemplate, {
      ...item,
      created_at: moment(item.created_at).format("h:mm a"),
    });
    lists.insertAdjacentHTML("beforeend", html);
  });
});

const handleBtnClick = ({ name, code }) => {
  const user = {
    id: 1,
    name: "이현우",
  };

  socket.emit("generateMeeting", { name, code, user });
};

const enterMeeting = (data) => {
  console.log("data123", data);

  socket.emit("enterMeeting", data);
  window.location.href = "chat.html";
};
