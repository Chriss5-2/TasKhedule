
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

let timeInputsVisible = false;

function toggleScheduleInputs() {
    let selector = document.getElementById("schedule-type-selector");
    let freeContainer = document.getElementById("free-schedule-container");
    let fixedContainer = document.getElementById("fixed-schedule-container");
    
    // Safety check if elements don't exist yet (simpler loading handling)
    if(!selector || !freeContainer || !fixedContainer) return;

    if (selector.value === "fixed") {
        freeContainer.style.display = "none";
        fixedContainer.style.display = "flex";
        
        // When switching to fixed, we might want to calculate duration if times are already there
        // (though usually they are empty when switching mode)
        calculateDuration();
    } else {
        freeContainer.style.display = "flex";
        fixedContainer.style.display = "none";
        
        // Clear times when switching back to free mode
        let start = document.getElementById("new-task-start-time");
        if(start) start.value = "";
        let end = document.getElementById("new-task-end-time");
        if(end) end.value = "";
        
        // Not clearing duration values as user might want to keep what they typed
        // or re-type it. If we clear, we lose context if they switch back and forth.
    }
}

// removed duplicate toggleScheduleInputs

function calculateDuration() {
    // Calculo de duración basado en start/end time
    let startInput = document.getElementById("new-task-start-time");
    let endInput = document.getElementById("new-task-end-time");
    
    // Nuevos inputs
    let valInput = document.getElementById("task-duration-value");
    let unitSelect = document.getElementById("task-duration-unit");

    if (!startInput || !endInput) return; // Paranoia
    
    let start = startInput.value;
    let end = endInput.value;
    
    if (start && end) {
        let startTime = new Date(0, 0, 0, start.split(":")[0], start.split(":")[1]);
        let endTime = new Date(0, 0, 0, end.split(":")[0], end.split(":")[1]);
        
        let diffMs = endTime - startTime;
        
        // Manejar cruce de medianoche (ej: 23:00 a 01:00)
        // NOTA: Si cruzamos medianoche, el resultado es negativo simple.
        if (diffMs < 0) {
            // Ejemplo: 23:00 (timestamp X) a 01:00 (timestamp Y < X). 
            // diff = Y - X (negativo). 
            // Realmente queremos (24h - X) + Y. O sea diff + 24h.
            diffMs += 24 * 60 * 60 * 1000;
        }
        
        // Convertir a minutos totales
        let totalMinutes = Math.round(diffMs / 60000);
        
        if (valInput && unitSelect) {
            if (totalMinutes % 60 === 0 && totalMinutes > 0) {
                // Si es hora exacta, poner en Horas
                valInput.value = totalMinutes / 60;
                unitSelect.value = "h";
            } else {
                // Si no, poner en minutos (aunque sean mas de 60, ej 90m es mas claro que 1.5h a veces, pero dejemoslo simple)
                valInput.value = totalMinutes;
                unitSelect.value = "m";
            }
        }
    } else {
        // Si borra un tiempo, no borramos la duración manual necesariamente, 
        // pero la logica original borraba "task-duration-display".
        // Limpiamos si start o end se borran para que el usuario pueda escribir manualmente
        // Pero solo si estaba usando el calculo automatico? 
        // Mejor dejar limpio para evitar conflictos.
        if (valInput) valInput.value = "";
        if (unitSelect) unitSelect.value = "m";
    }
}

function calculateTaskPoints(durationStr) {
    // Basic validation
    if (!durationStr || typeof durationStr !== 'string') return 2; 

    // Parse minutes
    let minutes = 0;
    
    // Check "Xh"
    let hMatch = durationStr.match(/(\d+(\.\d+)?)h/);
    if (hMatch) {
       minutes += parseFloat(hMatch[1]) * 60;
    }
    
    // Check "Ym"
    let mMatch = durationStr.match(/(\d+)m/);
    if (mMatch) {
        minutes += parseInt(mMatch[1]);
    }
    
    // Logic as requested:
    // > 2 hrs (> 120 mins) => 7 pts
    // > 1 hr (> 60 mins) => 5 pts
    // <= 1 hr (<= 60 mins) OR no duration => 2 pts
    
    // Note: If minutes is 0 (e.g. invalid string), returns 2. Correct.
    
    if (minutes > 120) return 5;
    if (minutes > 60) return 3;
    return 1;
}

function importCSV(input) {
    let file = input.files[0];
    if (!file) return;

    let reader = new FileReader();
    reader.onload = function(e) {
        let content = e.target.result;
        // Normalizar saltos de linea
        let lines = content.replace(/\r\n/g, "\n").split("\n");
        let count = 0;

        if (lines.length > 0) {
            let firstLine = lines[0].toLowerCase();
            // Checking if header contains expected columns to skip
            if (firstLine.includes("dia") && (firstLine.includes("hora") || firstLine.includes("time"))) {
                lines.shift();
            }
        }

        // Mapa para normalizar nombres de días
        let dayMap = {
            "monday": "Monday", "lunes": "Monday",
            "tuesday": "Tuesday", "martes": "Tuesday",
            "wednesday": "Wednesday", "miercoles": "Wednesday", "miércoles": "Wednesday",
            "thursday": "Thursday", "jueves": "Thursday",
            "friday": "Friday", "viernes": "Friday",
            "saturday": "Saturday", "sabado": "Saturday", "sábado": "Saturday",
            "sunday": "Sunday", "domingo": "Sunday"
        };

        lines.forEach(line => {
            line = line.trim();
            if (!line) return;
            
            let parts = line.split(",");
            if (parts.length < 3) return; // Mínimo Dia, Hora, Actividad

            let dayRaw = parts[0].trim().toLowerCase();
            let keyDay = dayMap[dayRaw];

            if (!keyDay) return; // Día no válido, saltar

            let timeRange = parts[1].trim(); 
            let taskName = parts.slice(2).join(",").trim(); // Nombre actividad

            // Parsear hora: HH:mm-HH:mm
            let startTime = "";
            let endTime = "";
            let duration = "";

            if (timeRange.includes("-")) {
                let times = timeRange.split("-");
                startTime = times[0].trim();
                endTime = times[1].trim();
                
                // Intentar calcular duración
                try {
                    let parse = (t) => {
                        let [h, m] = t.split(":").map(Number);
                        return h * 60 + m;
                    }
                    let startM = parse(startTime);
                    let endM = parse(endTime);
                    if (!isNaN(startM) && !isNaN(endM)) {
                        let diff = endM - startM;
                        if (diff < 0) diff += 1440; // 24h * 60m
                        let h = Math.floor(diff / 60);
                        let m = diff % 60;
                        if (h > 0) duration += h + "h ";
                        if (m > 0) duration += m + "m";
                        duration = duration.trim();
                    }
                } catch(err) { /* Ignorar error de calculo */ }
            } else {
                startTime = timeRange;
            }

            if (!tasks[keyDay]) tasks[keyDay] = [];

            // Añadir tarea (Por defecto = true, asumimos recurrente)
            tasks[keyDay].push({
                name: taskName,
                completed: false,
                isDefault: true,
                startTime: startTime,
                endTime: endTime,
                duration: duration
            });
            count++;
        });

        saveData();
        load();
        alert(`Se han importado ${count} actividades.`);
        input.value = ""; 
    };
    reader.readAsText(file);
}

function toggleSidebar() {
    let sidebar = document.getElementById("sidebar");
    let overlay = document.getElementById("sidebar-overlay");
    
    sidebar.classList.toggle("active");
    overlay.classList.toggle("active");
}

let streak = 0;
let lastStreakDate = ""; // Formato "YYYY-MM-DD"
let activeStreakProtectors = 0; // Cantidad de "escudos" activos

// Variables para el modo desarrollador
let simulatedDayOffset = 0; 
let isDevMode = false;
let backupState = null; // Para guardar el estado real antes de entrar al sandbox
let devTaskHistory = {}; // Historial de completado por fecha para modo dev { "YYYY-MM-DD": ["TaskName1", "TaskName2"] }

function toggleDevMode() {
    let check = document.getElementById("dev-mode-toggle");
    let enteringDevMode = check.checked;
    
    // Mostrar/ocultar controles
    let controls = document.getElementById("dev-controls");
    let resetStreakBtn = document.getElementById("reset-streak-btn");
    
    if (enteringDevMode) {
        // ENTRAR A MODO DEV (SANDBOX)
        isDevMode = true;
        
        // 1. Guardar estado real actual
        backupState = {
            tasks: JSON.parse(JSON.stringify(tasks)),
            points: points,
            rewards: JSON.parse(JSON.stringify(rewards)),
            rewardsActive: rewardsActive,
            taskHistory: JSON.parse(JSON.stringify(taskHistory)),
            rewardHistory: JSON.parse(JSON.stringify(rewardHistory)),
            streak: streak,
            lastStreakDate: lastStreakDate,
            activeStreakProtectors: activeStreakProtectors
        };
        
        // Cargar historial dev si existe
        let savedDevHistory = localStorage.getItem("dev_rpg_task_completion_history");
        if(savedDevHistory) devTaskHistory = JSON.parse(savedDevHistory);
        else devTaskHistory = {};
        
        // Pre-cargar item "Protector" en tienda dev si no existe, solo para testear? 
        // No, mejor usar logica compartida.
        
        // UI Updates
        if(controls) controls.style.display = "block";
        if(resetStreakBtn) resetStreakBtn.style.display = "block";
        updateSimulatedDateDisplay();
        
    } else {
        // SALIR DE MODO DEV (RESTAURAR)
        isDevMode = false;
        
        if (backupState) {
            // Restaurar estado original
            tasks = backupState.tasks;
            points = backupState.points;
            rewards = backupState.rewards;
            rewardsActive = backupState.rewardsActive;
            taskHistory = backupState.taskHistory;
            rewardHistory = backupState.rewardHistory;
            streak = backupState.streak;
            lastStreakDate = backupState.lastStreakDate;
            activeStreakProtectors = backupState.activeStreakProtectors || 0;
            
            backupState = null; // Limpiar backup
        }
        
        // Resetear simulación de tiempo
        simulatedDayOffset = 0;

        // Limpiar historial de dev mode para que la próxima sesión sea fresca
        devTaskHistory = {};
        localStorage.removeItem("dev_rpg_task_completion_history");
        
        // UI Updates
        if(controls) controls.style.display = "none";
        if(resetStreakBtn) resetStreakBtn.style.display = "none";
        
        // Forzar guardado del estado restaurado para sobreescribir lo que hizo el Dev Mode en localStorage
        saveData();
        
        // Recargar vista
        currentViewDay = getDay();
        load();
    }
}

function getSimulatedDate() {
    let d = new Date();
    d.setDate(d.getDate() + simulatedDayOffset);
    return d;
}

function saveCurrentDayState() {
    if (!isDevMode) return;
    
    // Guardar solo si estamos simulando un día (simulatedDayOffset != 0) o ya empezamos dev mode
    // Guardar estado del día actual en historial dev antes de cambiar
    // NOTA: getSimulatedDate() retorna la fecha + offset
    let d = getSimulatedDate();
    d.setHours(0,0,0,0);
    // Formato YYYY-MM-DD
    let dateStr = d.getFullYear() + "-" + (d.getMonth()+1).toString().padStart(2, '0') + "-" + d.getDate().toString().padStart(2, '0');

    let dayName = getDay(); // "Monday", etc.
    
    if (tasks[dayName]) {
        // Guardar indices de tareas completadas
        let completedIndices = tasks[dayName]
            .map((t, i) => t.completed ? i : -1)
            .filter(i => i !== -1);
            
        devTaskHistory[dateStr] = completedIndices;
        localStorage.setItem("dev_rpg_task_completion_history", JSON.stringify(devTaskHistory));
    }
}

function loadDayState(dateStr) { // dateStr debe venir calculado
    if (!isDevMode) return;

    let dayName = getDay();
    let savedIndices = devTaskHistory[dateStr];
    
    if (tasks[dayName]) {
        if (savedIndices && Array.isArray(savedIndices)) {
            // Restaurar estado conocido
            tasks[dayName].forEach((t, i) => {
                t.completed = savedIndices.includes(i);
            });
        } else {
            // No hay historial para este día -> Limpiar (Día nuevo)
            tasks[dayName].forEach(t => {
                t.completed = false;
            });
        }
    }
}

function getSimulatedDateString() {
    let d = getSimulatedDate();
    d.setHours(0,0,0,0);
    return d.getFullYear() + "-" + (d.getMonth()+1).toString().padStart(2, '0') + "-" + d.getDate().toString().padStart(2, '0');
}

function simulateNextDay() {
    // 1. Guardar estado del dia que abandonamos
    saveCurrentDayState();

    // 2. Avanzar
    simulatedDayOffset++;
    updateSimulatedDateDisplay();
    
    // 3. Cargar estado del nuevo día
    currentViewDay = getDay(); 
    checkStreakContinuity(); 
    
    let newDateStr = getSimulatedDateString();
    loadDayState(newDateStr);

    saveData(); 
    load(); 
}

function updateSimulatedDateDisplay() {
    let d = getSimulatedDate();
    // Normalizar a medianoche para evitar problemas con toLocaleDateString y UTC
    d.setHours(0,0,0,0);
    // Usar formato explicito para asegurar consistencia
    let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let display = document.getElementById("simulated-date-display");
    if(display) {
        display.innerText = "Simulando: " + d.toLocaleDateString("es-ES", options);
    }
}

function navigateToDate(dateString) {
    if(!dateString) return;

    // 1. Guardar estado actual antes de saltar
    saveCurrentDayState();

    // Calcular offset desde hoy real hasta fecha target
    let parts = dateString.split('-');
    // Mes en Date es 0-11
    let targetDate = new Date(parts[0], parts[1]-1, parts[2]); 
    let today = new Date(); 
    today.setHours(0,0,0,0);
    targetDate.setHours(0,0,0,0);

    let diffMs = targetDate - today;
    let diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    
    simulatedDayOffset = diffDays;
    
    // UI Update
    updateSimulatedDateDisplay();
    currentViewDay = getDay(); 
    
    // IMPORTANTE: Check racha FIRST en caso de salto temporal grande
    checkStreakContinuity();
    
    // 2. Cargar estado del destino
    let newDateStr = getSimulatedDateString();
    loadDayState(newDateStr);
    
    saveData();
    load();
}

function saveData() {
    // Definir prefijo: "rpg_" para datos reales, "dev_rpg_" para sandbox
    let prefix = isDevMode ? "dev_rpg_" : "rpg_";
    
    // Si estamos en modo Dev, guardamos en el sandbox
    localStorage.setItem(prefix + "points", points);
    localStorage.setItem(prefix + "tasks", JSON.stringify(tasks));
    localStorage.setItem(prefix + "rewards", JSON.stringify(rewards));
    localStorage.setItem(prefix + "rewards_active", rewardsActive);
    localStorage.setItem(prefix + "task_history", JSON.stringify(taskHistory));
    localStorage.setItem(prefix + "reward_history", JSON.stringify(rewardHistory));
    localStorage.setItem(prefix + "streak", streak);
    localStorage.setItem(prefix + "last_streak_date", lastStreakDate);
    localStorage.setItem(prefix + "active_streak_protectors", activeStreakProtectors);
}

function loadData() {
    // Al cargar la app (inicio), SIEMPRE cargamos los datos reales ("rpg_").
    let prefix = "rpg_";

    let savedPoints = localStorage.getItem(prefix + "points");
    if (savedPoints !== null) points = parseInt(savedPoints);

    let savedStreak = localStorage.getItem(prefix + "streak");
    if (savedStreak !== null) streak = parseInt(savedStreak);

    let savedLastStreakDate = localStorage.getItem(prefix + "last_streak_date");
    if (savedLastStreakDate !== null) lastStreakDate = savedLastStreakDate;
    
    let savedProtectors = localStorage.getItem(prefix + "active_streak_protectors");
    if (savedProtectors !== null) activeStreakProtectors = parseInt(savedProtectors);

    // Verificar si se rompió la racha (si ayer no se completó)
    // Se mueve al final para asegurar que taskHistory esté cargado si se necesita
    // if (!isDevMode) checkStreakContinuity(); 

    let savedTasks = localStorage.getItem(prefix + "tasks");
    if (savedTasks !== null) {
        tasks = JSON.parse(savedTasks);
        
        // Migración: Asegurar que todas las tareas sean objetos y tengan isDefault si es legacy
        for (let day in tasks) {
            tasks[day] = tasks[day].map((t, index) => {
                if (typeof t === 'string') {
                    let isInitial = false;
                    if (initialTasks[day]) {
                        isInitial = initialTasks[day].includes(t);
                    }
                    return { name: t, completed: false, isDefault: isInitial };
                }
                if (typeof t === 'object' && t.isDefault === undefined) {
                     let isInitial = false;
                    if (initialTasks[day]) {
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
        for (let day in tasks) {
            tasks[day] = tasks[day].map(t => {
                 if (typeof t === 'string') {
                    return { name: t, completed: false, isDefault: true };
                }
                return t; 
            });
        }
    }

    let savedRewards = localStorage.getItem(prefix + "rewards");
    if (savedRewards !== null) rewards = JSON.parse(savedRewards);

    let savedRewardsActive = localStorage.getItem(prefix + "rewards_active");
    if (savedRewardsActive !== null) rewardsActive = (savedRewardsActive === 'true');
    
    // Migración de datos antiguos si existen
    let oldHistory = localStorage.getItem("rpg_history");
    if (oldHistory !== null) {
        taskHistory = JSON.parse(oldHistory);
        localStorage.removeItem("rpg_history"); 
    } else {
        let savedTaskHistory = localStorage.getItem(prefix + "task_history");
        if (savedTaskHistory !== null) taskHistory = JSON.parse(savedTaskHistory);
    }

    let savedRewardHistory = localStorage.getItem(prefix + "reward_history");
    if (savedRewardHistory !== null) rewardHistory = JSON.parse(savedRewardHistory);
    
    checkStreakContinuity();
}

function toggleRewards() {
    rewardsActive = !rewardsActive;
    saveData();
    updateRewardsVisibility();
}

function checkStreakContinuity() {
    let today = getSimulatedDate();
    today.setHours(0, 0, 0, 0); 

    if (lastStreakDate) {
        // Asegurar parsing correcto de YYYY-MM-DD como fecha local
        let parts = lastStreakDate.split('-');
        let lastDate = new Date(parts[0], parts[1] - 1, parts[2]);
        lastDate.setHours(0, 0, 0, 0);
        
        let diffTime = today - lastDate;
        let diffDays = diffTime / (1000 * 60 * 60 * 24);

        // Si lastStreakDate fue ayer, mantenemos racha intacta (no sumamos aun, solo verificamos no perderla)
        // Si fue hoy, ya se sumó.
        // Si fue hace más de 1 día (ej. anteayer), racha perdida = 0.
        // Tolerancia pequeña por errores de punto flotante
        if (Math.round(diffDays) > 1) {
            // Lógica de Protección de Racha
            if (activeStreakProtectors > 0) {
                // Gastar un escudo por cada dia perdido? 
                // O gastar uno solo para salvar la racha actual?
                // Simplifiquemos: 1 escudo salva la racha tras volver (aunque haya pasado 1 semana).
                // Pero lo lógico es que el escudo cubra "el día que no viniste".
                // Si faltaste 3 días, necesitarías 3 escudos.
                
                let daysMissed = Math.floor(diffDays) - 1;
                
                if (activeStreakProtectors >= daysMissed) {
                    activeStreakProtectors -= daysMissed;
                    alert(`¡RACHA SALVADA! 🛡️\nHas usado ${daysMissed} protector(es) de racha por los días ausentes.`);
                    // No reseteamos streak.
                    // Actualizamos lastStreakDate a "ayer" para que parezca que no pasó nada y hoy pueda sumar?
                    // No, simplemente al no resetear, cuando complete hoy sumará.
                } else {
                    // No tiene suficientes escudos
                    activeStreakProtectors = 0; // Se consumen intentando salvar
                    streak = 0;
                    alert("¡RACHA PERDIDA! 😢\nNo tenías suficientes protectores de racha para cubrir tu ausencia.");
                }
            } else {
                streak = 0;
            }
            saveData();
        }
    } else {
        streak = 0;
    }
    
    // update UI
    if (document.getElementById("streak")) {
        document.getElementById("streak").innerText = streak;
    }
}

function updateStreakStatus() {
    let todayDate = getSimulatedDate();
    todayDate.setHours(0, 0, 0, 0);
    let todayStr = todayDate.toLocaleDateString('en-CA'); // YYYY-MM-DD local

    // Si ya se ha contabilizado la racha hoy (lastStreakDate == hoy), no hacer nada
    if (lastStreakDate === todayStr) {
        return;
    }

    // Obtener tareas del día actual (REAL)
    // El sistema usa getDay() que retorna el nombre en inglés del día actual real.
    let todayName = getDay(); 
    let dayTasks = tasks[todayName] || [];
    
    // Filtrar tareas por defecto
    let defaultTasks = dayTasks.filter(t => t.isDefault);
    let totalDefault = defaultTasks.length;

    // Si no hay tareas por defecto hoy, no se puede avanzar racha (o se regala?).
    // Supongamos que se necesita actividad. 
    if (totalDefault === 0) return; 

    // Contar completadas
    let completedDefault = defaultTasks.filter(t => t.completed).length;

    // Lógica: "cantidad de tareas por defecto del día - 1"
    // Si hay 1 tarea: 1-1=0? No tiene sentido, mínimo 1 para contar.
    // Si hay 5 tareas: 5-1=4.
    let threshold = Math.max(1, totalDefault - 1);

    if (completedDefault >= threshold) {
        // Racha conseguida!
        streak++;
        lastStreakDate = todayStr;
        saveData();
        
        // Animación simple
        let s = document.getElementById("streak");
        if(s) {
            s.innerText = streak;
            s.style.transition = "transform 0.3s";
            s.style.transform = "scale(1.5)";
            setTimeout(() => s.style.transform = "scale(1)", 300);
        }
    }
}

function resetStreak() {
    if (confirm("¿Estás seguro de que deseas reiniciar tu racha a 0?")) {
        streak = 0;
        lastStreakDate = "";
        saveData();
        document.getElementById("streak").innerText = streak;
    }
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


let isCalendarMode = false;
let calendarModeDate = null; // Objeto Date

function enableCalendarMode(dateString) {
    if (!dateString) return;
    
    // Parse fecha seleccionada (input date devuelve YYYY-MM-DD)
    let parts = dateString.split("-");
    let selectedDate = new Date(parts[0], parts[1] - 1, parts[2]);
    selectedDate.setHours(0, 0, 0, 0);

    // Comparar con hoy (simulado si está en dev, real si no)
    let today = getSimulatedDate();
    today.setHours(0, 0, 0, 0);

    // Si selecciona "hoy", salir del modo calendario
    if (selectedDate.getTime() === today.getTime()) {
        exitCalendarMode();
        return;
    }

    isCalendarMode = true;
    calendarModeDate = selectedDate;

    // Actualizar UI
    document.getElementById("calendar-mode-banner").style.display = "block";
    
    // Cambiar vista al día de la semana correspondiente
    let days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    let dayName = days[selectedDate.getDay()];
    
    // IMPORTANTE: Aquí cambiamos el valor del selector visualmente, 
    // pero internally la app usa 'currentViewDay' para cargar las tareas RECURRENTES de ese día de la semana.
    // Si queremos tareas personalizadas por FECHA ESPECIFICA, necesitamos una estructura de datos nueva 
    // o modificar la existente para soportar fechas.
    // Actualmente 'tasks' es { Monday: [...], Tuesday: [...] }.
    // El usuario pide "actividades personalizadas" para esa fecha.
    // Esto implica persistencia por fecha específica: tasksByDate = { "2023-10-27": [...] }
    // De momento, mostramos las tareas recurrentes de ese día de la semana (que es lo que el sistema soporta)
    // y permitimos editarlas. Al editarlas en 'tasks[Monday]', se cambian para TODOS los lunes.
    // SI el usuario quiere tareas únicas para UNA fecha, requeriría un refactor mayor del modelo de datos.
    // ASUMIRÉ por "ver que tareas tiene" que se refiere a las tareas programadas para ese día de la semana.
    // "pueda tener actividades personalizadas": Si edita, afectará a todos los lunes (modelo actual).
    
    // Corrección: El usuario quiere "actividades personalizadas" para esa fecha.
    // Sin cambiar todo el backend localStorage, podemos simularlo si usamos el mecanismo de DevMode 'devTaskHistory' 
    // pero para tareas futuras? No, eso solo guarda completion status.
    // Dado el alcance, mantendremos el comportamiento de "Ver Lunes" (que son las tareas de todos los lunes).
    // Si agrega una tarea, se agregará al Lunes recurrente.
    
    document.getElementById("day-selector").value = dayName;
    changeDay(); // Esto actualiza 'currentViewDay' y recarga
    
    // Forzar actualización del título con la fecha específica seleccionada
    let d = calendarModeDate; 
    let dayNames = {
        "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
        "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
    };
    let dateStrDisplay = d.toLocaleDateString("es-ES", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById("day").innerText = dateStrDisplay.charAt(0).toUpperCase() + dateStrDisplay.slice(1);
}

function exitCalendarMode() {
    isCalendarMode = false;
    calendarModeDate = null;
    document.getElementById("calendar-mode-banner").style.display = "none";
    document.getElementById("calendar-date-input").value = ""; // Limpiar input
    
    // Volver a hoy
    goToToday();
}

function getDay() {
    // Si estamos en modo calendario, el "día actual para la vista" es el seleccionado
    if (isCalendarMode && calendarModeDate) {
         return calendarModeDate.toLocaleDateString("en-US", { weekday: "long" });
    }
    
    let d = getSimulatedDate();
    let day = d.toLocaleDateString("en-US", { weekday: "long" });
    return day;
}

// Sobreescribir goToToday para manejar la salida del modo calendario
const originalGoToToday = window.goToToday || function() {};
window.goToToday = function() {
    if (isCalendarMode) {
        exitCalendarMode();
        return; // exitCalendarMode ya llama a goToToday (pero con flag false) -> recursion risk if not careful
        // Actually exitCalendarMode resets flag then calls goToToday.
        // So we need to separate logic.
    }
    
    // Lógica original de goToToday (restaurada manual o llamada si existiera)
    // Como no tengo la ref original accesible fácil, la reimplemento safe:
    let today = getSimulatedDate();
    let day = today.toLocaleDateString("en-US", { weekday: "long" });
    let selector = document.getElementById("day-selector");
    if(selector) selector.value = day;
    currentViewDay = day;
    
    // Reset visual
    isCalendarMode = false; 
    document.getElementById("calendar-mode-banner").style.display = "none";
    
    load();
};



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

function deleteAllTasks() {
    if (confirm("¿Estás seguro de que deseas BORRAR TODAS LAS TAREAS de todos los días?\n\nEsta acción eliminará todas las actividades, incluyendo las recurrentes/por defecto.\n\nTus puntos, historial y recompensas SE MANTENDRÁN.")) {
        tasks = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };
        saveData();
        load();
        alert("Todas las tareas han sido eliminadas.");
    }
}

function resetAll() {
    if (confirm("¡ADVERTENCIA CRÍTICA! ¿Estás seguro de que quieres BORRAR TODO? \n\nSe eliminarán TODAS las tareas (incluyendo las tareas por defecto), el historial, las recompensas y los puntos.\n\nEl sistema volverá a estar completamente vacío.")) {
        // Reiniciar todo a estado inicial vacio
        tasks = {
            Monday: [],
            Tuesday: [],
            Wednesday: [],
            Thursday: [],
            Friday: [],
            Saturday: [],
            Sunday: []
        };
        
        rewards = [];
        points = 0;
        streak = 0;
        lastStreakDate = "";
        activeStreakProtectors = 0;
        taskHistory = [];
        rewardHistory = []; 
        goToToday();
        saveData();
        updatePoints();
        updateStreakDisplay();
        
        // Simular clic en "Ir a día actual" para refrescar la vista completamente sin recargar
        
        
        alert("El sistema se ha reiniciado por completo.");
    }
}


function showAddTaskForm() {
    let btn = document.getElementById("btn-show-add-task");
    if(btn) btn.style.display = "none";
    let container = document.getElementById("add-task-container");
    if(container) container.style.display = "flex";
}

function hideAddTaskForm() {
    let container = document.getElementById("add-task-container");
    if(container) container.style.display = "none";
    let btn = document.getElementById("btn-show-add-task");
    if(btn) btn.style.display = "inline-block";
    clearAddTaskForm();
}

function clearAddTaskForm() {
    let input = document.getElementById("new-task-input");
    if(input) input.value = "";
    
    let startTimeInput = document.getElementById("new-task-start-time");
    let endTimeInput = document.getElementById("new-task-end-time");
    
    if(startTimeInput) startTimeInput.value = "";
    if(endTimeInput) endTimeInput.value = "";
    
    let durationValueInput = document.getElementById("task-duration-value");
    let durationUnitSelect = document.getElementById("task-duration-unit");
    
    if(durationValueInput) durationValueInput.value = "";
    if(durationUnitSelect) durationUnitSelect.value = "m";
    
    let checkbox = document.getElementById("is-default-task");
    if(checkbox) checkbox.checked = false;
}

function addTask() {
    let input = document.getElementById("new-task-input");
    let taskName = input.value.trim();
    
    // Obtener valores de hora
    let startTimeInput = document.getElementById("new-task-start-time");
    let endTimeInput = document.getElementById("new-task-end-time");
    
    // Updated duration inputs
    let durationValueInput = document.getElementById("task-duration-value");
    let durationUnitSelect = document.getElementById("task-duration-unit");

    let startTime = startTimeInput ? startTimeInput.value : "";
    let endTime = endTimeInput ? endTimeInput.value : "";
    
    let durVal = durationValueInput ? durationValueInput.value.trim() : "";
    let durUnit = durationUnitSelect ? durationUnitSelect.value : "m";
    
    let duration = "";
    
    // Si tenemos horario fijo, calculamos y formateamos la duración específicamente
    if (startTime && endTime) {
        let s = new Date(0, 0, 0, startTime.split(":")[0], startTime.split(":")[1]);
        let e = new Date(0, 0, 0, endTime.split(":")[0], endTime.split(":")[1]);
        let diffMs = e - s;
        if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // Cruce de medianoche
        
        let totalMinutes = Math.round(diffMs / 60000);
        
        if (totalMinutes <= 60) {
            duration = `${totalMinutes}min`;
        } else {
            let h = Math.floor(totalMinutes / 60);
            let m = totalMinutes % 60;
            if (m === 0) {
                duration = `${h}hrs`;
            } else {
                duration = `${h}hrs, ${m}min`;
            }
        }
    } else if (durVal !== "") {
        // Modo manual (Horario Libre)
        duration = durVal + durUnit;
    }

    let checkbox = document.getElementById("is-default-task");
    let isDefault = checkbox ? checkbox.checked : false;

    if (taskName !== "") {
        if (!tasks[currentViewDay]) {
            tasks[currentViewDay] = [];
        }
        // Guardar como objeto con estado completado, si es por defecto, horario y duración
        tasks[currentViewDay].push({ 
            name: taskName, 
            completed: false, 
            isDefault: isDefault,
            startTime: startTime,
            endTime: endTime,
            duration: duration
        });
        
        // input.value = ""; // Removed: addTask should probably not auto-clear if we have a clear button? Or yes? 
        // User workflow: Add -> Clear -> Add Next? Or Add -> Keep Form Open?
        // Typically "Add" adds and clears inputs so you can add another.
        // "Limpiar" is for when you made a mistake BEFORE adding.
        // So I will keep the clean up logic.
        
        clearAddTaskForm();
        
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

    // Permitir costo 0 o negativo solo en DevMode? No, mejor mantener consistencia o permitir en dev.
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
                let startTime = (typeof task === 'object' && task.startTime) ? task.startTime : "";
                let endTime = (typeof task === 'object' && task.endTime) ? task.endTime : "";
                let duration = (typeof task === 'object' && task.duration) ? task.duration : "";
                
                let text = taskName;
                if(startTime || endTime) {
                    let timeText = "";
                    if(startTime && endTime) timeText = ` (${startTime} - ${endTime})`;
                    else if(startTime) timeText = ` (> ${startTime})`;
                    else if(endTime) timeText = ` (< ${endTime})`;
                    text += timeText;
                } else if(duration) {
                     text += ` (${duration})`;
                }
                
                li.innerText = text;
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
    
    if (rewards.length === 0) {
        let emptyMsg = document.createElement("p");
        emptyMsg.innerText = "No hay recompensas configuradas.";
        emptyMsg.style.fontStyle = "italic";
        rewardsGrid.appendChild(emptyMsg);
    } else {
        rewards.forEach(r => {
            let card = document.createElement("div");
            card.className = "task reward-card-general"; // Use the main task class for glassmorphism and a new class for overrides
            
            // Special styling for "Protector de Racha"
            if(r.name === "Protector de Racha") {
                card.classList.add("protector-card");
            }

            let title = document.createElement("h3");
            title.innerText = r.name;
            title.className = "reward-title-general";
            card.appendChild(title);

            let cost = document.createElement("p");
            cost.innerText = "Costo: " + r.cost + " pts";
            cost.className = "reward-cost-general";
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

function goToToday() {
    let today = getDay(); // Obtiene el día actual real (o simulado si dev mode)
    goToDay(today);
}

function goToHome() {
    // Si estamos en modo calendario, salimos a hoy
    if (typeof isCalendarMode !== 'undefined' && isCalendarMode) {
        exitCalendarMode();
        return;
    }
    
    // Si estamos en otras vistas, volvemos a la principal
    document.getElementById("general-view").style.display = "none";
    document.getElementById("history-view").style.display = "none";
    document.getElementById("daily-view").style.display = "block";
    
    // Asegurar que estamos en el día actual
    goToToday();
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
        item.className = "history-item";
        item.style.borderBottom = "1px solid rgba(255,255,255,0.1)";
        
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


function getSimulatedDayName() {
    let d = getSimulatedDate();
    return d.toLocaleDateString("en-US", { weekday: "long" });
}

function load() {

    // En modo calendario, 'today' devuelve el dia seleccionado.
    // Necesitamos saber si estamos visualizando el dia "real" actual para habilitar completar.
    // Logica corregida:
    
    let currentViewArg = currentViewDay;
    let trueTodayName = getSimulatedDayName();
    
    // Si isCalendarMode es true, NO permitimos completar NUNCA.
    // Si isCalendarMode es false, permitimos completar SOLO si currentViewDay == trueTodayName.
    
    let canComplete = !isCalendarMode && (currentViewArg === trueTodayName);

    // ...resto del codigo...
    
    updateRewardsVisibility();
    
    // UI Updates
    let selector = document.getElementById("day-selector");
    if (selector && selector.value !== currentViewDay) {
        selector.value = currentViewDay;
    }

    // Header Date Display
    let dayNames = {
        "Monday": "Lunes", "Tuesday": "Martes", "Wednesday": "Miércoles",
        "Thursday": "Jueves", "Friday": "Viernes", "Saturday": "Sábado", "Sunday": "Domingo"
    };
    
    let displayDateStr = "";
    
    if (isCalendarMode && calendarModeDate) {
        // En modo calendario, mostrar fecha exacta seleccionada
        displayDateStr = calendarModeDate.toLocaleDateString("es-ES", { day: 'numeric', month: 'long', year: 'numeric' });
    } else {
        // En modo normal, mostrar fecha relativa al día visualizado vs hoy
        // (Similar a lógica anterior)
        let daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        let currentDayIndex = getSimulatedDate().getDay(); 
        let selectedDayIndex = daysOfWeek.indexOf(currentViewDay);
        
        let diff = selectedDayIndex - currentDayIndex;
        // Ajuste para mostrar siempre fecha de "esta semana" (Lunes a Domingo)
        // El getDay() de JS es Dom=0. Nuestra semana empieza Lunes?
        // Mas sencillo: Simplemente sumamos diff. Si es negativo es un dia pasado de esta semana.
        
        let targetDate = getSimulatedDate();
        targetDate.setDate(targetDate.getDate() + diff);
         displayDateStr = targetDate.toLocaleDateString("es-ES", { day: 'numeric', month: 'numeric', year: 'numeric' });
    }

    document.getElementById("day").innerText = (dayNames[currentViewDay] || currentViewDay) + " - " + displayDateStr;
    
    // ...

    // Reemplazar la variable 'isToday' antigua por 'canComplete' en la lógica de botones
    // ...
    // Buscar donde se usaba 'if (isToday)' y cambiar a 'if (canComplete)'
    
    // OJO: Como replace_string afecta bloques específicos, necesitamos asegurar que el bloque inferior use la variable correcta.
    // Arriba, en el bloque de botones, puse: if (!isCalendarMode && (currentViewDay === getSimulatedDayName()))
    // Eso es equivalente a `canComplete`.

    // Ocultar o mostrar el contenedor de agregar tarea

    // let addTaskContainer = document.getElementById("add-task-container");
    // if (addTaskContainer) {
    //    addTaskContainer.style.display = "block"; 
    // }
    
    // NOTA: Ya no forzamos la visualización al cargar. 
    // El estado de visualización se mantiene tal cual estaba antes de llamar a load()
    // Si estaba cerrado, sigue cerrado. Si estaba abierto (agregando varias tareas), sigue abierto.
    // Solo al inicio de la app (carga inicial de script) debería estar cerrado por CSS/HTML default.

    let list = tasks[currentViewDay] || [];

    let container =
        document.getElementById("tasks");


    container.innerHTML = "";


    list.forEach((taskObj, index) => {

        // Asegurar que taskObj sea un objeto
        let taskName = (typeof taskObj === 'string') ? taskObj : taskObj.name;
        let isCompleted = (typeof taskObj === 'object' && taskObj.completed);
        let isDefault = (typeof taskObj === 'object' && taskObj.isDefault);
        let startTime = (typeof taskObj === 'object' && taskObj.startTime) ? taskObj.startTime : "";
        let endTime = (typeof taskObj === 'object' && taskObj.endTime) ? taskObj.endTime : "";

        let div =
            document.createElement("div");

        div.className = "task";
        if (isCompleted) {
            div.classList.add("completed");
        }

        if (isDefault) {
            let dot = document.createElement("div");
            dot.className = "default-task-dot";
            dot.title = "Tarea por defecto (Recurrente)";
            div.appendChild(dot);
        }

        let contentDiv = document.createElement("div");
        contentDiv.style.textAlign = "center"; 
        contentDiv.style.width = "100%";
        
        let nameDiv = document.createElement("div");
        nameDiv.innerText = taskName;
        nameDiv.style.fontWeight = "bold";
        if (isCompleted) {
            nameDiv.style.textDecoration = "line-through";
            nameDiv.style.opacity = "0.7";
        }
        contentDiv.appendChild(nameDiv);

        let timeText = "";
        
        // Prioridad: Mostrar horario si existe, sino mostrar duración
        if (startTime || endTime) {
             if(startTime && endTime) timeText = `🕒 ${startTime} - ${endTime}`;
             else if(startTime) timeText = `🕒 Desde ${startTime}`;
             else if(endTime) timeText = `🕒 Hasta ${endTime}`;
             
             // Si hay duración calculada o manual, agregarla
             if(taskObj.duration) {
                 timeText += ` (${taskObj.duration})`;
             }
        } else if (taskObj.duration) {
            timeText = `⏱️ ${taskObj.duration}`;
        }

        if (timeText) {
            let timeDiv = document.createElement("div");
            timeDiv.style.fontSize = "0.85em";
            timeDiv.style.color = "var(--text-secondary)";
            timeDiv.style.marginTop = "2px";
            timeDiv.innerText = timeText;
            if (isCompleted) {
                 timeDiv.style.textDecoration = "line-through";
            }
            contentDiv.appendChild(timeDiv);
        }
        
        div.appendChild(contentDiv);

        // Contenedor de botones
        let btnContainer = document.createElement("div");
        btnContainer.style.marginTop = "10px";
        btnContainer.style.display = "flex";
        btnContainer.style.gap = "5px";
        btnContainer.style.justifyContent = "center";

        // Lógica de botones:
        // 1. Si es modo calendario: NO mostrar completar. Solo mostrar eliminar (siempre habilitado abajo).
        // 2. Si NO es modo calendario y es hoy: Mostrar Completar.
        
        if (!isCalendarMode && (currentViewDay === getSimulatedDayName())) { 
             // getSimulatedDayName helper needed or use getSimulatedDate
             // Simplificación: Comparamos con el día "real/simulado" actual, no con el del selector.
             // Pero 'load()' verifica 'isToday' basado en currentViewDay === today.
             // El problema es que getDay() ahora devuelve el día del calendario si está activo.
             // Necesitamos separar "Día de la vista" de "Día de Hoy".
             
             // Restauramos lógica original dentro del if isToday que ya existía en load()
             // isToday se calculaba al inicio de load(): let today = getDay(); let isToday = (currentViewDay === today);
             // Con mi cambio a getDay(), 'today' será la fecha calendario.
             // Así que isToday será true si el selector coincide.
             // Pero queremos bloquear completar en modo calendario.
             
             // Bloqueo explícito:
             if(true) { // Placeholder para mantener estructura, la lógica real está abajo
             
                if (!isCompleted) {
                    let btn = document.createElement("button");
                    btn.innerText = "Completar";
                    // ...
                    btn.onclick = function () {
                        // ... (código existente de completar) ...
                         // Registrar historial
                        let now = new Date();
                        let record = {
                            taskName: taskName,
                            day: dayNames[currentViewDay] || currentViewDay,
                            date: now.toLocaleDateString(),
                            time: now.toLocaleTimeString()
                        };
                        taskHistory.push(record);

                        // Registrar puntos variables
                        let pts = 2; // Default (<= 1 hr o sin duración)
                        let taskItem = tasks[currentViewDay][index];
                        if(typeof taskItem === 'object' && taskItem.duration) {
                             pts = calculateTaskPoints(taskItem.duration);
                        }
                        
                        points += pts;
                        
                        // Registrar historial
                        if (typeof tasks[currentViewDay][index] === 'string') {
                            tasks[currentViewDay][index] = { name: tasks[currentViewDay][index], completed: true };
                        } else {
                            tasks[currentViewDay][index].completed = true;
                        }

                        // Verificar si se han completado TODAS las tareas por defecto del dia actual
                        let currentDayList = tasks[currentViewDay] || [];
                        let defaults = currentDayList.filter(t => (typeof t === 'object' && t.isDefault));
                        if (defaults.length > 0) {
                            let allDone = defaults.every(t => t.completed);
                            if(allDone) {
                                 points += 3;
                                 alert("🎉 ¡FELICITACIONES! 🎉\n\nHas completado todas las tareas obligatorias de hoy.\n¡Recibes 3 puntos extra!");
                            }
                        }

                        updatePoints();
                        saveData();
                        load();
                    };
                    btnContainer.appendChild(btn);
                } else {
                    let btn = document.createElement("button");
                    btn.innerText = "Repetir";
                    btn.className = "btn-warning";
                    btn.onclick = function () {
                        if(confirm("¿Quieres repetir esta tarea? Se volverá a habilitar y podrás completarla de nuevo.")) {
                            tasks[currentViewDay][index].completed = false;
                            saveData();
                            load();
                        }
                    };
                    btnContainer.appendChild(btn);
                }
             }
        } else if (isCalendarMode) {
            // Modo espectador: No botones de acción de estado
            // Solo mensaje informativo opcional? No, dejar limpio.
        }

        let deleteBtn = document.createElement("button");
        deleteBtn.innerText = "Eliminar";
        deleteBtn.className = "btn-danger";
        
        deleteBtn.onclick = function() {
            if(confirm("¿Estás seguro de que deseas eliminar esta tarea?")) {
                tasks[currentViewDay].splice(index, 1);
                saveData();
                load();
            }
        };
        btnContainer.appendChild(deleteBtn);

        div.appendChild(btnContainer);

        container.appendChild(div);

    });


    loadRewards();

    updatePoints();
    
    updateStreakStatus();

}



function updatePoints() {

    document.getElementById("points").innerText
        = points;

}



function loadRewards() {

    let container =
        document.getElementById("rewards");

    container.innerHTML = "";
    
    // Asegurar que el "Protector de racha" exista 
    let protectorName = "Protector de Racha";
    let hasProtector = rewards.some(r => r.name === protectorName);
    
    if (!hasProtector) {
        // Añadir al principio
        rewards.unshift({ name: protectorName, cost: 50 }); // Costo ejemplo 50
    }

    // Mostrar Estado de Escudos
    if(activeStreakProtectors > 0) {
        let statusDiv = document.createElement("div");
        statusDiv.style.background = "linear-gradient(90deg, rgba(40, 167, 69, 0.2), rgba(0, 0, 0, 0))";
        statusDiv.style.borderLeft = "4px solid #28a745";
        statusDiv.style.color = "#98ffb3";
        statusDiv.style.padding = "10px";
        statusDiv.style.marginBottom = "15px";
        statusDiv.style.borderRadius = "5px";
        statusDiv.style.textAlign = "left";
        statusDiv.style.fontWeight = "bold";
        statusDiv.style.gridColumn = "1 / -1"; // Ocupar todo el ancho
        statusDiv.innerText = "🛡️  TIENES " + activeStreakProtectors + " PROTECTOR(ES) DE RACHA ACTIVO(S)";
        container.appendChild(statusDiv);
    }


    rewards.forEach((r, index) => {

        let div =
            document.createElement("div");

        div.className = "task";
        
        // Estilo especial para protector
        if(r.name === protectorName) {
            div.style.borderColor = "#28a745";
            div.style.background = "linear-gradient(135deg, rgba(40, 167, 69, 0.1), rgba(0,0,0,0.2))";
            div.style.boxShadow = "0 0 15px rgba(40, 167, 69, 0.2)";
        }

        let textSpan = document.createElement("span");
        textSpan.innerText = (r.cost == 1 ? r.name + " - " + r.cost + " punto" : r.name + " - " + r.cost + " puntos") + " ";
        div.appendChild(textSpan);

        let btn =
            document.createElement("button");

        btn.innerText = "Reclamar";


        btn.onclick = function () {

            if (points >= r.cost) {

                if(confirm(`¿Deseas canjear "${r.name}" por ${r.cost} puntos?`)) {

                    // LOGICA ESPECIFICA PARA PROTECTOR
                    if(r.name === protectorName) {
                        activeStreakProtectors++;
                        points -= r.cost;
                        
                        // Registrar en historial como Item Especial
                        let now = new Date();
                        let record = {
                            rewardName: "🛡️ " + r.name,
                            cost: r.cost,
                            date: now.toLocaleDateString(),
                            time: now.toLocaleTimeString()
                        };
                        rewardHistory.push(record);

                        updatePoints();
                        saveData();
                        loadRewards(); // Recargar para ver el escudo activo
                        alert("¡PROTECTOR ACTIVADO! 🛡️\nTu racha está protegida por 1 día fallido.");
                        return; // Salir para no ejecutar alerta genérica
                    }

                    // Registrar en historial de recompensas normal
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

                    alert("Recompensa obtenida: " + r.name);
                }

            }

            else {

                alert("No tienes puntos");

            }

        };


        div.appendChild(btn);

        // Boton Eliminar (No permitir eliminar el protector por defecto)
        if(r.name !== protectorName) {
            let deleteBtn = document.createElement("button");
            deleteBtn.innerText = "Eliminar";
            deleteBtn.className = "btn-danger";
            
            deleteBtn.onclick = function() {
                if(confirm("¿Estás seguro de que deseas eliminar esta recompensa?")) {
                    rewards.splice(index, 1);
                    saveData();
                    loadRewards();
                }
            };
            div.appendChild(deleteBtn);
        }

        container.appendChild(div);

    });

}


loadData();
load();

// --- Token Export/Import Logic ---

function generateToken() {
    const data = {
        tasks: JSON.parse(localStorage.getItem('rpg_tasks') || JSON.stringify(initialTasks)),
        rewards: JSON.parse(localStorage.getItem('rpg_rewards') || '[]'),
        points: parseInt(localStorage.getItem('rpg_points') || '0'),
        streak: parseInt(localStorage.getItem('rpg_streak') || '0'),
        lastLogin: localStorage.getItem('rpg_last_login') || '',
        taskHistory: JSON.parse(localStorage.getItem('rpg_task_history') || '[]'),
        rewardHistory: JSON.parse(localStorage.getItem('rpg_reward_history') || '[]')
    };
    return btoa(encodeURIComponent(JSON.stringify(data)));
}

function showExportTokenModal() {
    const modal = document.getElementById('token-modal');
    const title = document.getElementById('token-modal-title');
    const desc = document.getElementById('token-modal-desc');
    const textArea = document.getElementById('token-area');
    const actionBtn = document.getElementById('token-action-btn');

    title.innerText = "Exportar Token";
    desc.innerText = "Copia este token para importar tus datos en otro dispositivo.";
    textArea.value = generateToken();
    textArea.readOnly = true;
    
    actionBtn.innerText = "Copiar Token";
    actionBtn.onclick = copyToken;
    
    modal.style.display = "flex";
}

function showImportTokenModal() {
    const modal = document.getElementById('token-modal');
    const title = document.getElementById('token-modal-title');
    const desc = document.getElementById('token-modal-desc');
    const textArea = document.getElementById('token-area');
    const actionBtn = document.getElementById('token-action-btn');

    title.innerText = "Importar Token";
    desc.innerText = "Pega aquí el token generado en tu otro dispositivo.";
    textArea.value = "";
    textArea.readOnly = false;
    
    // Ensure cleanup of previous dynamic buttons
    const container = actionBtn.parentElement;
    const extraBtns = container.querySelectorAll('.import-btn-option');
    extraBtns.forEach(b => b.remove());
    
    actionBtn.style.display = "inline-block";
    actionBtn.innerText = "Importar";
    actionBtn.onclick = function() {
        const token = textArea.value.trim();
        if (!token) return alert("Por favor, introduce un token.");

        // Hide original "Importar" button
        actionBtn.style.display = "none";
        
        // --- Create Dynamic Option Buttons ---
        
        // 1. Importar Datos (Full)
        const btnFull = document.createElement("button");
        btnFull.innerText = "Importar Datos";
        btnFull.className = "import-btn-option";
        btnFull.style.backgroundColor = "#4CAF50"; // Green
        btnFull.style.marginRight = "10px";
        btnFull.onclick = () => processTokenImport(token, 'full');

        // 2. Importar Solo Tareas (Reset tasks to not done)
        const btnTasks = document.createElement("button");
        btnTasks.innerText = "Importar Tareas";
        btnTasks.className = "import-btn-option";
        btnTasks.style.backgroundColor = "#2196F3"; // Blue
        btnTasks.style.marginRight = "10px";
        btnTasks.onclick = () => processTokenImport(token, 'tasks-only');

        // Insert buttons before the hidden action button (to keep order in container)
        container.insertBefore(btnFull, actionBtn);
        container.insertBefore(btnTasks, actionBtn);
    };
    
    modal.style.display = "flex";
}

function processTokenImport(token, mode) {
    try {
        const jsonString = decodeURIComponent(atob(token));
        const data = JSON.parse(jsonString);

        if (!data.tasks) throw new Error("Datos inválidos en el token");

        if (mode === 'full') {
            if (confirm("Se reemplazarán TODAS las tareas, puntos, racha e historial. ¿Continuar?")) {
                localStorage.setItem('rpg_tasks', JSON.stringify(data.tasks));
                localStorage.setItem('rpg_rewards', JSON.stringify(data.rewards || []));
                localStorage.setItem('rpg_points', (data.points || 0).toString());
                localStorage.setItem('rpg_streak', (data.streak || 0).toString());
                if (data.lastLogin) localStorage.setItem('rpg_last_login', data.lastLogin);
                localStorage.setItem('rpg_task_history', JSON.stringify(data.taskHistory || []));
                localStorage.setItem('rpg_reward_history', JSON.stringify(data.rewardHistory || []));
                
                alert("Importación completa. Recargando...");
                location.reload();
            }
        } else if (mode === 'tasks-only') {
            if (confirm("Se reemplazarán tus tareas actuales con las del token (se marcarán como pendientes). Puntos y racha NO cambiarán. ¿Continuar?")) {
                // Reset completed status for all tasks
                Object.keys(data.tasks).forEach(day => {
                    data.tasks[day].forEach(task => {        
                         task.completed = false; // Force reset
                    });
                });
                
                localStorage.setItem('rpg_tasks', JSON.stringify(data.tasks));
                // Rewards also? Usually 'Importar solo tareas' implies structure. Let's keep rewards if they exist in token to be safe, or ignore?
                // Request said "Importar solo tareas". I'll assume rewards are part of "Full Data".
                // So we ONLY update 'rpg_tasks'.
                
                alert("Tareas importadas (reiniciadas). Recargando...");
                location.reload();
            }
        }

    } catch (e) {
        console.error(e);
        alert("Error al procesar el token. Verifica que sea válido.");
    }
}

function closeTokenModal() {
    const modal = document.getElementById('token-modal');
    modal.style.display = "none";
    
    // Cleanup dynamic options in case closed while open
    const actionBtn = document.getElementById('token-action-btn');
    if (actionBtn && actionBtn.parentElement) {
        actionBtn.parentElement.querySelectorAll('.import-btn-option').forEach(b => b.remove());
        actionBtn.style.display = "inline-block";
    }
}

function copyToken() {
    const textArea = document.getElementById('token-area');
    textArea.select();
    document.execCommand('copy');
    alert("Token copiado al portapapeles");
}

/* Old functions removed/replaced by above */


