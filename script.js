// Variables globales
let currentAccount = null;
let currentDomain = '';
let messages = [];

// Elementos DOM
const currentEmailElement = document.getElementById('current-email');
const errorMessageElement = document.getElementById('error-message');
const copyBtn = document.getElementById('copy-btn');
const changeBtn = document.getElementById('change-btn');
const refreshBtn = document.getElementById('refresh-btn');
const emailList = document.getElementById('email-list');
const changeModal = document.getElementById('change-modal');
const cancelChangeBtn = document.getElementById('cancel-change');
const confirmChangeBtn = document.getElementById('confirm-change');
const toast = document.getElementById('toast');
const toastIcon = document.getElementById('toast-icon');
const toastText = document.getElementById('toast-text');
const messageModal = document.getElementById('message-modal');
const messageBody = document.getElementById('message-body');
const closeMessageBtn = document.getElementById('close-message');
const closeMessageBtn2 = document.getElementById('close-message-btn');
const creatorChipContainer = document.getElementById('creator-chip-container');

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    initApp();
    createCreatorChip();
});

// Event listeners
copyBtn.addEventListener('click', copyEmailToClipboard);
changeBtn.addEventListener('click', showChangeModal);
cancelChangeBtn.addEventListener('click', hideChangeModal);
confirmChangeBtn.addEventListener('click', changeEmail);
refreshBtn.addEventListener('click', fetchMessages);
closeMessageBtn.addEventListener('click', hideMessageModal);
closeMessageBtn2.addEventListener('click', hideMessageModal);

// Cerrar modal al hacer clic fuera del contenido
messageModal.addEventListener('click', (e) => {
    if (e.target === messageModal) hideMessageModal();
});

// Función para crear el chip del creador
function createCreatorChip() {
    const creatorChip = document.createElement('div');
    creatorChip.className = 'creator-chip';
    creatorChip.innerHTML = `
        <div class="creator-avatar">H</div>
        <div class="creator-name">@hjofc123</div>
        <div class="creator-buttons">
            <a class="creator-btn whatsapp" href="https://wa.me/5214437863111" target="_blank">
                <i class="material-icons">chat</i>
            </a>
            <a class="creator-btn telegram" href="https://t.me/hjofc123" target="_blank">
                <i class="material-icons">send</i>
            </a>
        </div>
    `;
    creatorChipContainer.appendChild(creatorChip);
}

// Función para inicializar la aplicación
async function initApp() {
    // Mostrar estado de carga
    emailList.innerHTML = `
        <div class="loading">
            <div class="loading-spinner"></div>
        </div>
    `;
    
    // Obtener un dominio disponible primero
    await getAvailableDomain();
    
    // Verificar si hay una cuenta guardada
    const savedAccount = localStorage.getItem('tempMailAccount');
    
    if (savedAccount) {
        try {
            currentAccount = JSON.parse(savedAccount);
            await loginToAccount();
            currentEmailElement.textContent = currentAccount.address;
            errorMessageElement.style.display = 'none';
            await fetchMessages();
        } catch (error) {
            console.error('Error al cargar la cuenta guardada:', error);
            await createNewAccount();
        }
    } else {
        await createNewAccount();
    }
    
    // Iniciar polling para nuevos mensajes
    setInterval(fetchMessages, 10000); // Consultar cada 10 segundos
}

// Función para obtener un dominio disponible
async function getAvailableDomain() {
    try {
        const response = await fetch('https://api.mail.tm/domains');
        if (!response.ok) {
            throw new Error('Error al obtener dominios');
        }
        
        const data = await response.json();
        if (data && data['hydra:member'] && data['hydra:member'].length > 0) {
            // Obtener el primer dominio disponible
            currentDomain = data['hydra:member'][0].domain;
            return currentDomain;
        } else {
            throw new Error('No hay dominios disponibles');
        }
    } catch (error) {
        console.error('Error al obtener dominio:', error);
        showError('Error al conectar con el servicio');
        throw error;
    }
}

// Función para crear una nueva cuenta
async function createNewAccount() {
    try {
        if (!currentDomain) {
            await getAvailableDomain();
        }
        
        // Generar una dirección de correo aleatoria
        const randomString = Math.random().toString(36).substring(2, 10);
        const address = `${randomString}@${currentDomain}`;
        const password = Math.random().toString(36).substring(2);
        
        // Crear la cuenta en la API
        const accountResponse = await fetch('https://api.mail.tm/accounts', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                password: password
            })
        });
        
        if (!accountResponse.ok) {
            const errorData = await accountResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error al crear la cuenta');
        }
        
        const accountData = await accountResponse.json();
        
        // Obtener token de autenticación
        const tokenResponse = await fetch('https://api.mail.tm/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                address: address,
                password: password
            })
        });
        
        if (!tokenResponse.ok) {
            throw new Error('Error al obtener el token de autenticación');
        }
        
        const tokenData = await tokenResponse.json();
        
        // Guardar la cuenta actual
        currentAccount = {
            id: accountData.id,
            address: accountData.address,
            password: password,
            token: tokenData.token
        };
        
        // Guardar en localStorage
        localStorage.setItem('tempMailAccount', JSON.stringify(currentAccount));
        
        // Actualizar la UI
        currentEmailElement.textContent = currentAccount.address;
        errorMessageElement.style.display = 'none';
        
    } catch (error) {
        console.error('Error al crear una nueva cuenta:', error);
        showError('Error al crear email');
    }
}

// Función para mostrar error
function showError(message) {
    errorMessageElement.textContent = message;
    errorMessageElement.style.display = 'flex';
    currentEmailElement.textContent = 'Error al crear email';
}

// Función para iniciar sesión en una cuenta existente
async function loginToAccount() {
    try {
        const response = await fetch('https://api.mail.tm/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                address: currentAccount.address,
                password: currentAccount.password
            })
        });
        
        if (!response.ok) {
            throw new Error('Error al iniciar sesión');
        }
        
        const tokenData = await response.json();
        currentAccount.token = tokenData.token;
        
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        throw error;
    }
}

// Función para obtener los mensajes
async function fetchMessages() {
    if (!currentAccount || !currentAccount.token) return;
    
    try {
        const response = await fetch('https://api.mail.tm/messages', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentAccount.token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            if (response.status === 401) {
                // Token inválido, intentar renovarlo
                await loginToAccount();
                return fetchMessages();
            }
            throw new Error('Error al obtener mensajes');
        }
        
        const newMessages = await response.json();
        messages = newMessages;
        
        // Actualizar la bandeja de entrada
        updateInbox(messages);
        
    } catch (error) {
        console.error('Error al obtener mensajes:', error);
    }
}

// Función para actualizar la bandeja de entrada
function updateInbox(messages) {
    if (!messages || messages.length === 0) {
        emailList.innerHTML = `
            <div class="empty-inbox">
                <i class="material-icons">inbox</i>
                <p>No hay mensajes</p>
                <div class="subtext">Los correos recibidos aparecerán aquí</div>
            </div>
        `;
        return;
    }
    
    // Ordenar mensajes por fecha (más recientes primero)
    messages.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    emailList.innerHTML = '';
    
    messages.forEach(message => {
        const listItem = document.createElement('li');
        listItem.className = 'email-item';
        
        // Formatear la fecha
        const date = new Date(message.createdAt);
        const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        listItem.innerHTML = `
            <div class="email-subject">
                <i class="material-icons">mail</i>
                ${message.subject || 'Sin asunto'}
            </div>
            <div class="email-sender">De: ${message.from.name || message.from.address}</div>
            <div class="email-preview">${getPreview(message)}</div>
            <div class="email-date">
                <i class="material-icons">access_time</i>
                ${formattedDate}
            </div>
        `;
        
        listItem.addEventListener('click', () => {
            viewMessage(message.id);
        });
        
        emailList.appendChild(listItem);
    });
}

// Función para obtener una vista previa del mensaje
function getPreview(message) {
    if (message.intro) {
        return message.intro.length > 100 ? message.intro.substring(0, 100) + '...' : message.intro;
    }
    return 'Sin contenido';
}

// Función para ver un mensaje completo
async function viewMessage(messageId) {
    if (!currentAccount || !currentAccount.token) return;
    
    try {
        const response = await fetch(`https://api.mail.tm/messages/${messageId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${currentAccount.token}`,
                'Accept': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error('Error al obtener el mensaje');
        }
        
        const message = await response.json();
        showMessageModal(message);
        
    } catch (error) {
        console.error('Error al ver el mensaje:', error);
        showToast('Error al cargar el mensaje', 'error');
    }
}

// Función para mostrar el modal con el mensaje completo
function showMessageModal(message) {
    const date = new Date(message.createdAt);
    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
    
    let messageContent = '';
    
    if (message.html && message.html.length > 0) {
        // Si el mensaje tiene contenido HTML
        messageContent = `
            <div class="message-sender">De: ${message.from.name || message.from.address}</div>
            <div class="message-date">${formattedDate}</div>
            <div class="message-subject">${message.subject || 'Sin asunto'}</div>
            <div class="message-html">${message.html}</div>
        `;
    } else {
        // Si el mensaje solo tiene texto plano
        messageContent = `
            <div class="message-sender">De: ${message.from.name || message.from.address}</div>
            <div class="message-date">${formattedDate}</div>
            <div class="message-subject">${message.subject || 'Sin asunto'}</div>
            <div class="message-text">${message.text || 'Sin contenido'}</div>
        `;
    }
    
    messageBody.innerHTML = messageContent;
    messageModal.style.display = 'flex';
}

// Función para ocultar el modal de mensaje
function hideMessageModal() {
    messageModal.style.display = 'none';
}

// Función para copiar el email al portapapeles
function copyEmailToClipboard() {
    if (!currentAccount) return;
    
    navigator.clipboard.writeText(currentAccount.address)
        .then(() => {
            showToast('Email copiado al portapapeles', 'success');
        })
        .catch(err => {
            console.error('Error al copiar: ', err);
            showToast('Error al copiar el email', 'error');
        });
}

// Función para mostrar el modal de cambio de email
function showChangeModal() {
    changeModal.style.display = 'flex';
}

// Función para ocultar el modal de cambio de email
function hideChangeModal() {
    changeModal.style.display = 'none';
}

// Función para cambiar de email
async function changeEmail() {
    hideChangeModal();
    
    // Limpiar la cuenta guardada
    localStorage.removeItem('tempMailAccount');
    currentAccount = null;
    
    // Crear una nueva cuenta
    await createNewAccount();
    await fetchMessages();
}

// Función para mostrar notificación toast
function showToast(message, type = 'success') {
    toastText.textContent = message;
    toast.className = 'toast show ' + type;
    
    if (type === 'success') {
        toastIcon.textContent = 'check_circle';
    } else {
        toastIcon.textContent = 'error';
    }
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}
