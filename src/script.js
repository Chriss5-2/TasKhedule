
let points = 0;

let tasks = {
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
    Sunday: []
};

const initialTasks = JSON.parse(JSON.stringify(tasks));

let rewards = [];

// Historiales
let taskHistory = [];
let rewardHistory = []; 

let rewardsActive = true;

function saveData() {
    localStorage.setItem("rpg_points", points);
    localStorage.setItem("rpg_tasks", JSON.stringify(tasks));
    localStorage.setItem("rpg_rewards", JSON.stringify(rewards));
    localStorage.setItem("rpg_rewards_active", rewardsActive);
    localStorage.setItem("rpg_task_history", JSON.stringify(taskHistory));
    localStorage.setItem("rpg_reward_history", JSON.stringify(rewardHistory));
}

function loadData() {
    let savedPoints = localStorage.getItem("rpg_points");
    if (savedPoints !== null) points = parseInt(savedPoints);

    let savedTasks = localStorage.getItem("rpg_tasks");
    if (savedTasks !== null) {
        tasks = JSON.parse(savedTasks);
        
        // Migración: Asegurar que todas las tareas sean objetos y tengan isDefault si es legacy
        for (let day in tasks) {
            tasks[day] = tasks[day].map((t, index) => {
                // Si es string (legacy muy antiguo), convertir
                if (typeof t === 'string') {
                    // Check if it's in initialTasks, if so mark as default.
                    // Actually, simpler to assume if user didn't explicitly set it, it's not default unless we detect it.
                    // But initialTasks was: "Mineria", "Rust", etc.
                    // If we want to preserve old behavior, we could mark them as default.
                    
                    let isInitial = false;
                    if (initialTasks[day]) {
                        isInitial = initialTasks[day].includes(t);
                    }
                    
                    return { name: t, completed: false, isDefault: isInitial };
                }
                // Si es objeto pero no tiene isDefault (legacy reciente), inicializar
                if (typeof t === 'object' && t.isDefault === undefined) {
                    // Check against initialTasks
                     let isInitial = false;
                    if (initialTasks[day]) {
                        // Check if initialTasks has strings or objects (it was strings originally)
                         if (initialTasks[day].some(initialT => (typeof initialT === 'string' ? initialT : initialT.name) === t.name)) {
                             isInitial = true;
                         }
                    }
                    t.isDefault = isInitial;
                }
                return t;
            });
        }
    } else {
        // Primera carga absoluta, convertir initialTasks a formato con isDefault
        // initialTasks eran strings.
        for (let day in tasks) {
            tasks[day] = tasks[day].map(t => {
                 if (typeof t === 'string') {
                    return { name: t, completed: false, isDefault: true };
                }
                return t; // Should not happen given initialTasks format
            });
        }
    }

    let savedRewards = localStorage.getItem("rpg_rewards");
    if (savedRewards !== null) rewards = JSON.parse(savedRewards);

    let savedRewardsActive = localStorage.getItem("rpg_rewards_active");
    if (savedRewardsActive !== null) rewardsActive = (savedRewardsActive === 'true');
    
    // Migración de datos antiguos si existen
    let oldHistory = localStorage.getItem("rpg_history");
    if (oldHistory !== null) {
        taskHistory = JSON.parse(oldHistory);
        localStorage.removeItem("rpg_history"); // Limpiar dato antiguo
    } else {
        let savedTaskHistory = localStorage.getItem("rpg_task_history");
        if (savedTaskHistory !== null) taskHistory = JSON.parse(savedTaskHistory);
    }

    let savedRewardHistory = localStorage.getItem("rpg_reward_history");
    if (savedRewardHistory !== null) rewardHistory = JSON.parse(savedRewardHistory);
}

function toggleRewards() {
    rewardsActive = !rewardsActive;
    saveData();
    updateRewardsVisibility();
}

function updateRewardsVisibility() {
    let section = document.getElementById("rewards-section");
    let btn = document.getElementById("toggle-rewards-btn");
    let pointsContainer = document.getElementById("points-container");

    if (rewardsActive) {
        section.style.display = "block";
        if (pointsContainer) pointsContainer.style.display = "block";
        btn.innerText = "Desactivar Gamificación";
        btn.style.backgroundColor = ""; 
        btn.style.color = "";
    } else {
        section.style.display = "none";
        if (pointsContainer) pointsContainer.style.display = "none";
        btn.innerText = "Activar Gamificación";
        btn.style.backgroundColor = "#ccc"; 
        btn.style.color = "#333";
    }
}

function getDay() {

    let d = new Date().toLocaleDateString("en-US", { weekday: "long" });

    return d;

}

let currentViewDay = getDay();

function changeDay() {
    currentViewDay = document.getElementById("day-selector").value;
    load();
}

function resetDay() {
    if (confirm("¿Estás seguro de que quieres reiniciar las tareas de este día? Se borrarán las tareas que NO sean 'por defecto' y se reiniciará el estado de las que sí lo son.")) {
        // Filtrar tareas, mantener solo las que son por defecto
        let currentTasks = tasks[currentViewDay] || [];
        
        let newTaskList = currentTasks.filter(task => {
            // Mantener si es por defecto (o si es una de las tareas iniciales legacy que asumimos como por defecto)
            // Las tareas iniciales no tenian propiedad isDefault, asi que para mantener compatibilidad con las hardcodeadas al inicio,
            // podriamos asumir que si esta en initialTasks es default, pero initialTasks ya no se usa tanto.
            // Mejor: Si tiene isDefault: true, se queda.
            return (task.isDefault === true);
        });

        // Reiniciar estado de completado para las que quedan
        newTaskList.forEach(task => {
            task.completed = false;
        });

        // Si no habia tareas con isDefault, podriamos querer restaurar las iniciales hardcodeadas si es que el usuario no ha modificado nada?
        // Pero la logica antigua era restaurar initialTasks.
        // Ahora la logica es: "solo se borrarán las que no son por defecto".
        // Si no hay ninguna "por defecto", newTaskList será vacio.
        // Para respetar las tareas hardcodeadas originales (Lunes: Mineria, etc), deberiamos haberlas marcado como default al cargar.

        tasks[currentViewDay] = newTaskList;
        saveData();
        load();
    }
}

function resetAll() {
    if (confirm("¿Estás seguro de que quieres reiniciar todo? Se borrarán las tareas NO 'por defecto', se reiniciarán las completadas y los puntos volverán a 0.")) {
        // Reiniciar tareas preservando solo las "default"
        for (let day in tasks) {
            let dayTasks = tasks[day] || [];
            // Filtrar y reiniciar estado
            tasks[day] = dayTasks.filter(t => t.isDefault === true).map(t => {
                t.completed = false;
                return t;
            });
        }
        
        rewards = [];
        points = 0;
        taskHistory = [];
        rewardHistory = []; 
        saveData();
        updatePoints();
        load();
    }
}


function addTask() {
    let input = document.getElementById("new-task-input");
    let taskName = input.value.trim();
    let checkbox = document.getElementById("is-default-task");
    let isDefault = checkbox ? checkbox.checked : false;

    if (taskName !== "") {
        if (!tasks[currentViewDay]) {
            tasks[currentViewDay] = [];
        }
        // Guardar como objeto con estado completado y si es por defecto
        tasks[currentViewDay].push({ name: taskName, completed: false, isDefault: isDefault });
        input.value = "";
        if (checkbox) checkbox.checked = false;
        saveData();
        load();
    } else {
        alert("Por favor, ingresa un nombre para la tarea.");
    }
}

function addReward() {
    let nameInput = document.getElementById("new-reward-name");
    let costInput = document.getElementById("new-reward-cost");
    
    let name = nameInput.value.trim();
    let cost = parseInt(costInput.value);

    if (name !== "" && !isNaN(cost) && cost > 0) {
        rewards.push({ name: name, cost: cost });
        nameInput.value = "";
        costInput.value = "";
        saveData();
        loadRewards();
    } else {
        alert("Por favor, ingresa un nombre válido y un costo mayor a 0 para la recompensa.");
    }
}

function showGeneralSchedule() {
    document.getElementById("daily-view").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("general-view").style.display = "block";

    let grid = document.getElementById("general-schedule-grid");
    grid.innerHTML = "";

    let dayNames = {
        "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
        "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
    };

    let daysOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

    daysOrder.forEach(day => {
        let card = document.createElement("div");
        card.className = "day-card";
        card.onclick = function() {
            goToDay(day);
        };

        let title = document.createElement("h3");
        title.innerText = dayNames[day];
        card.appendChild(title);

        let ul = document.createElement("ul");
        let dayTasks = tasks[day] || [];
        
        if (dayTasks.length === 0) {
            let li = document.createElement("li");
            li.innerText = "Sin tareas";
            li.style.color = "gray";
            li.style.fontStyle = "italic";
            ul.appendChild(li);
        } else {
            dayTasks.forEach(task => {
                let li = document.createElement("li");
                // Manejar tanto string antiguo como objeto nuevo
                let taskName = (typeof task === 'string') ? task : task.name;
                let isCompleted = (typeof task === 'object' && task.completed);
                
                li.innerText = taskName;
                if (isCompleted) {
                    li.style.textDecoration = "line-through";
                    li.style.color = "green";
                }
                
                ul.appendChild(li);
            });
        }

        card.appendChild(ul);
        grid.appendChild(card);
    });

    let rewardsGrid = document.getElementById("general-rewards-grid");
    rewardsGrid.innerHTML = "";

    if (!rewardsActive) {
        let disabledMsg = document.createElement("p");
        disabledMsg.innerText = "Las recompensas están desactivadas.";
        disabledMsg.style.fontStyle = "italic";
        disabledMsg.style.color = "gray";
        rewardsGrid.appendChild(disabledMsg);
        return;
    }
    
    // Función auxiliar para crear tarjetas
    const createCardStyle = (element) => {
        element.style.background = "white";
        element.style.padding = "15px";
        element.style.width = "200px";
        element.style.borderRadius = "10px";
        element.style.boxShadow = "0px 0px 5px gray";
        element.style.textAlign = "center";
        element.style.margin = "10px";
    };

    if (rewards.length === 0) {
        let emptyMsg = document.createElement("p");
        emptyMsg.innerText = "No hay recompensas configuradas.";
        emptyMsg.style.fontStyle = "italic";
        rewardsGrid.appendChild(emptyMsg);
    } else {
        rewards.forEach(r => {
            let card = document.createElement("div");
            createCardStyle(card);

            let title = document.createElement("h3");
            title.innerText = r.name;
            title.style.borderBottom = "1px solid #eee";
            title.style.paddingBottom = "5px";
            title.style.marginBottom = "5px";
            title.style.fontSize = "16px";
            title.style.marginTop = "0";
            card.appendChild(title);

            let cost = document.createElement("p");
            cost.innerText = "Costo: " + r.cost + " pts";
            cost.style.fontWeight = "bold";
            cost.style.color = "#007bff";
            cost.style.margin = "0";
            card.appendChild(cost);

            rewardsGrid.appendChild(card);
        });
    }
}

function goToDay(day) {
    document.getElementById("general-view").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("daily-view").style.display = "block";
    currentViewDay = day;
    document.getElementById("day-selector").value = day;
    load();
}

function goToPreviousView() {
    document.getElementById("general-view").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("daily-view").style.display = "block";
    load();
}

function showHistory() {
    document.getElementById("daily-view").style.display = "none";
    document.getElementById("general-view").style.display = "none";
    document.getElementById("history-view").style.display = "block";
    
    // Por defecto mostrar ambos
    setHistoryView('both');
}

function setHistoryView(viewType) {
    let taskCol = document.getElementById("task-history-column");
    let rewardCol = document.getElementById("reward-history-column");
    let contentContainer = document.getElementById("history-content");
    let taskList = document.getElementById("task-history-list");
    let rewardList = document.getElementById("reward-history-list");

    // Limpiar contenido previo para evitar duplicados
    taskList.innerHTML = "";
    rewardList.innerHTML = "";

    if (viewType === 'tasks') {
        taskCol.style.display = "block";
        rewardCol.style.display = "none";
        renderHistoryList(taskHistory, "task-history-list", "task");
    } else if (viewType === 'rewards') {
        taskCol.style.display = "none";
        rewardCol.style.display = "block";
        renderHistoryList(rewardHistory, "reward-history-list", "reward");
    } else if (viewType === 'both') {
        taskCol.style.display = "block";
        rewardCol.style.display = "block";
        renderHistoryList(taskHistory, "task-history-list", "task");
        renderHistoryList(rewardHistory, "reward-history-list", "reward");
    }
}

function renderHistoryList(data, containerId, type) {
    let container = document.getElementById(containerId);
    container.innerHTML = "";

    if (!data || data.length === 0) {
        container.innerHTML = "<p style='color: gray; font-style: italic; text-align: center;'>No hay registros.</p>";
        return;
    }

    // Ordenar historial del más reciente al más antiguo
    let sortedData = data.slice().reverse();

    sortedData.forEach(record => {
        let item = document.createElement("div");
        item.style.backgroundColor = "white";
        item.style.borderBottom = "1px solid #eee";
        item.style.padding = "10px";
        item.style.marginBottom = "5px";
        item.style.borderRadius = "5px";
        
        let header = document.createElement("div");
        header.style.fontSize = "12px";
        header.style.color = "gray";
        
        let content = document.createElement("div");
        content.style.fontSize = "16px";

        if (type === 'task') {
            header.innerText = `${record.date} ${record.time || ''} - ${record.day || ''}`;
            content.innerText = record.taskName;
            content.style.color = "#28a745";
        } else {
            header.innerText = `${record.date} ${record.time || ''}`;
            content.innerText = `${record.rewardName} (-${record.cost} pts)`;
            content.style.color = "#e0a800"; // Gold/Dark Yellow
        }

        item.appendChild(header);
        item.appendChild(content);
        container.appendChild(item);
    });
}

function clearHistory() {
    if (confirm("¿Estás seguro de que deseas limpiar todo el historial (tareas y recompensas)?")) {
        taskHistory = [];
        rewardHistory = [];
        saveData();
        showHistory(); // Recargar vista
    }
}


function load() {

    let today = getDay();
    // ...resto del codigo...
    
    updateRewardsVisibility();

    let isToday = (currentViewDay === today);

    // Sincronizar el selector con el día actual si es la primera carga
    let selector = document.getElementById("day-selector");
    if (selector && selector.value !== currentViewDay) {
        selector.value = currentViewDay;
    }

    // Mostrar el día seleccionado en el título
    let dayNames = {
        "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
        "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
    };
    document.getElementById("day").innerText = dayNames[currentViewDay] || currentViewDay;

    // Ocultar o mostrar el contenedor de agregar tarea
    let addTaskContainer = document.getElementById("add-task-container");
    if (addTaskContainer) {
        addTaskContainer.style.display = "block"; // Siempre mostrar para poder agregar tareas a cualquier día
    }

    let list = tasks[currentViewDay] || [];

    let container =
        document.getElementById("tasks");


    container.innerHTML = "";


    list.forEach((taskObj, index) => {

        // Asegurar que taskObj sea un objeto
        let taskName = (typeof taskObj === 'string') ? taskObj : taskObj.name;
        let isCompleted = (typeof taskObj === 'object' && taskObj.completed);
        let isDefault = (typeof taskObj === 'object' && taskObj.isDefault);

        let div =
            document.createElement("div");

        div.className = "task";
        if (isCompleted) {
            div.style.backgroundColor = "#d4edda"; // Verde claro para completadas
            div.style.borderColor = "#c3e6cb";
        }

        if (isDefault) {
            let dot = document.createElement("div");
            dot.className = "default-task-dot";
            dot.title = "Tarea por defecto (Recurrente)";
            div.appendChild(dot);
        }

        let textSpan = document.createElement("span");
        textSpan.innerText = taskName + " ";
        if (isCompleted) {
            textSpan.style.textDecoration = "line-through";
            textSpan.style.color = "#155724";
        }
        div.appendChild(textSpan);

        if (isToday) {
            if (!isCompleted) {
                let btn = document.createElement("button");
                btn.innerText = "Completar";
                btn.style.marginRight = "5px";

                btn.onclick = function () {
                    // Registrar historial
                    let now = new Date();
                    let record = {
                        taskName: taskName,
                        day: dayNames[currentViewDay] || currentViewDay,
                        date: now.toLocaleDateString(),
                        time: now.toLocaleTimeString()
                    };
                    taskHistory.push(record);

                    points += 5;
                    
                    // Marcar como completada
                    if (typeof tasks[currentViewDay][index] === 'string') {
                        tasks[currentViewDay][index] = { name: tasks[currentViewDay][index], completed: true };
                    } else {
                        tasks[currentViewDay][index].completed = true;
                    }

                    updatePoints();
                    saveData();
                    load(); // Recargar para actualizar UI
                };
                div.appendChild(btn);
            } else {
                // Botón Repetir
                let btn = document.createElement("button");
                btn.innerText = "Repetir";
                btn.style.marginRight = "5px";
                btn.style.backgroundColor = "#ffc107";
                btn.style.color = "black";
                
                btn.onclick = function () {
                    if(confirm("¿Quieres repetir esta tarea? Se volverá a habilitar y podrás completarla de nuevo.")) {
                        tasks[currentViewDay][index].completed = false;
                        saveData();
                        load();
                    }
                };
                div.appendChild(btn);
            }
        }

        let deleteBtn = document.createElement("button");
        deleteBtn.innerText = "Eliminar";
        deleteBtn.style.backgroundColor = "#ff4c4c"; 
        deleteBtn.style.color = "white"; 
        deleteBtn.style.border = "none";
        
        deleteBtn.onclick = function() {
            if(confirm("¿Estás seguro de que deseas eliminar esta tarea?")) {
                tasks[currentViewDay].splice(index, 1);
                saveData();
                load();
            }
        };
        div.appendChild(deleteBtn);

        container.appendChild(div);

    });


    loadRewards();

    updatePoints();

}



function updatePoints() {

    document.getElementById("points").innerText
        = points;

}



function loadRewards() {

    let container =
        document.getElementById("rewards");

    container.innerHTML = "";


    rewards.forEach((r, index) => {

        let div =
            document.createElement("div");

        div.className = "task";

        let textSpan = document.createElement("span");
        textSpan.innerText = (r.cost == 1 ? r.name + " - " + r.cost + " punto" : r.name + " - " + r.cost + " puntos") + " ";
        div.appendChild(textSpan);

        let btn =
            document.createElement("button");

        btn.innerText = "Reclamar";


        btn.onclick = function () {

            if (points >= r.cost) {

                // Registrar en historial de recompensas
                let now = new Date();
                let record = {
                    rewardName: r.name,
                    cost: r.cost,
                    date: now.toLocaleDateString(),
                    time: now.toLocaleTimeString()
                };
                rewardHistory.push(record);

                points -= r.cost;

                updatePoints();
                saveData();

                alert("Recompensa obtenida");

            }

            else {

                alert("No tienes puntos");

            }

        };


        div.appendChild(btn);

        let deleteBtn = document.createElement("button");
        deleteBtn.innerText = "Eliminar";
        deleteBtn.style.backgroundColor = "#ff4c4c"; 
        deleteBtn.style.color = "white"; 
        deleteBtn.style.border = "none";
        
        deleteBtn.onclick = function() {
            if(confirm("¿Estás seguro de que deseas eliminar esta recompensa?")) {
                rewards.splice(index, 1);
                saveData();
                loadRewards();
            }
        };
        div.appendChild(deleteBtn);

        container.appendChild(div);

    });

}


loadData();
load();
