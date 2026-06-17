# Sumsal Mobile - Migración de Lebaron a React Native

## ✅ Completado

He creado la arquitectura completa de la app mobile replicando las características principales de **lebaron**.

---

## 📱 Nuevas Pantallas Creadas

### 1. **TasksScreen** - Lista de Tareas
- `screens/TasksScreen.js`
- Muestra todas las tareas con:
  - 🔍 Buscador integrado
  - 🏷️ Filtrar por tema (consejos, peticiones, historias)
  - 📊 Estadísticas (likes, comentarios, compartidas)
  - 🔄 Refrescar manualmente
  - ➕ Botón flotante para crear

### 2. **CreateTaskScreen** - Crear Nueva Tarea
- `screens/CreateTaskScreen.js`
- Funcionalidades:
  - Seleccionar tipo (consejos, peticiones, historias)
  - Título con contador (100 caracteres)
  - Descripción con contador (1000 caracteres)
  - Cargar imagen desde galería
  - Seleccionar múltiples categorías
  - Envío a `/api/tasks/` con multipart/form-data

### 3. **TaskDetailScreen** - Detalle de Tarea
- `screens/TaskDetailScreen.js`
- Funcionalidades:
  - Mostrar imagen, título, descripción
  - ❤️ Like/Unlike
  - 💬 Comentarios anidados
  - 🔄 Compartir tarea (modal de confirmación)
  - Botón para agregar comentarios
  - Mostrar autor de cada comentario

### 4. **Navegación con Tabs**
- `App.js` actualizado con:
  - **Autenticación**: Login → Register → Dashboard
  - **Dashboard con 3 tabs**:
    - 🏠 Inicio (HomeScreen - perfil usuario)
    - 📋 Tareas (TasksStackNavigator)
    - 👤 Perfil (placeholder para expandir)

---

## 🔧 Instalación de Dependencias

Ejecuta en la terminal de `sumsal-mobile`:

```bash
npm install @react-navigation/bottom-tabs expo-image-picker
```

---

## 🚀 Pasos para Ejecutar

1. **Instala las dependencias**:
   ```bash
   cd c:\Users\owenf\Desktop\sumsal\sumsal-mobile
   npm install @react-navigation/bottom-tabs expo-image-picker
   ```

2. **Inicia el servidor del backend**:
   ```bash
   python manage.py runserver 0.0.0.0:8000
   ```

3. **Inicia Expo con cache limpio**:
   ```bash
   npx expo start -c
   ```

4. **Abre en el navegador**:
   - `http://localhost:19006`

---

## 📡 Endpoints de API Utilizados

| Pantalla | Endpoint | Método | Descripción |
|----------|----------|--------|-------------|
| TasksScreen | `/api/tasks/` | GET | Listar tareas |
| CreateTaskScreen | `/api/tasks/` | POST | Crear tarea |
| TaskDetailScreen | `/api/tasks/{id}/` | GET | Detalle de tarea |
| TaskDetailScreen | `/api/tasks/{id}/comments/` | GET | Comentarios de tarea |
| TaskDetailScreen | `/api/tasks/{id}/comments/` | POST | Agregar comentario |
| TaskDetailScreen | `/api/tasks/{id}/like/` | POST | Like/Unlike |
| TaskDetailScreen | `/api/shared-tasks/` | POST | Compartir tarea |
| CreateTaskScreen | `/api/new-categories/` | GET | Listar categorías |

---

## 🎨 Estilos y Diseño

- **Color principal**: `#4dabf7` (azul)
- **Colores secundarios**: 
  - Likes: `#ff6b6b` (rojo)
  - Comentarios: `#4dabf7` (azul)
  - Compartidas: `#51cf66` (verde)
- **Tipografía**: Escalable según contenido
- **Componentes**: Ionicons para todos los iconos

---

## 📝 Estado Actual

✅ Autenticación (Login/Register)
✅ Dashboard con navegación por tabs
✅ Listar tareas con filtros
✅ Crear tareas con imagen
✅ Ver detalle de tarea
✅ Sistema de likes
✅ Comentarios anidados
✅ Compartir tareas

---

## 🔜 Próximas Fases (Pendientes)

1. **Mensajes Directos**
   - Chat entre usuarios
   - Lista de conversaciones

2. **Mensajes Grupales**
   - Crear/unirse a grupos
   - Chat de grupo

3. **Historias 24h**
   - Cargar historias
   - Ver historias de otros

4. **Pantalla de Perfil**
   - Editar perfil
   - Ver tareas propias
   - Favoritos
   - Estadísticas

5. **Búsqueda Avanzada**
   - Filtrar por usuario
   - Filtrar por fecha
   - Búsqueda global

6. **Notificaciones**
   - Likes en tareas
   - Nuevos comentarios
   - Mensajes recibidos

---

## 🐛 Troubleshooting

### Error: "Module not found: '@react-navigation/bottom-tabs'"
```bash
npm install @react-navigation/bottom-tabs
```

### Error: "Module not found: 'expo-image-picker'"
```bash
npm install expo-image-picker
```

### Error: "Connection refused" en API
- Verifica que Django esté corriendo: `python manage.py runserver`
- Revisa que la URL en `api.js` sea correcta: `http://127.0.0.1:8000/api/`

### Campo de imagen no se sube
- Usa `multipart/form-data` en headers
- Verifica permisos de carpeta `/media/` en Django

---

## 📞 Notas

- El token JWT se guarda en `AsyncStorage`
- Las peticiones incluyen `Authorization: Bearer {token}` automáticamente
- Las imágenes se convierten a FormData antes de enviar
- Los comentarios soportan anidamiento (replies)

