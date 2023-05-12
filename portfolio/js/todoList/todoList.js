const textBox = document.getElementById("textBox");
const addButton = document.getElementById("addButton");
const todoList = document.getElementById("todoList");

addButton.addEventListener("click", () => {
    const text = textBox.value.trim();
    if (text === "") {
        return;
    }
    const todoItem = document.createElement("li");
    todoItem.classList.add("todoItem");
    const todoText = document.createElement("span");
    todoText.classList.add("todoText");
    todoText.textContent = text;
    const deleteButton = document.createElement("button");
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => {
        todoItem.remove();
    });
    todoItem.appendChild(todoText);
    todoItem.appendChild(deleteButton);
    todoList.appendChild(todoItem);
    textBox.value = "";
});
