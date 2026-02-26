# Guía para Actualizar/Configurar Java

Actualmente tienes **Java 17** instalado dentro de Android Studio, pero tu sistema está usando una versión antigua (Java 8) por defecto. Para arreglar esto, no necesitas descargar nada nuevo, solo apuntar tu sistema a la versión correcta.

## Opción A: Automática (Recomendada)

He creado un script para hacerlo por ti.

1.  Abre una terminal en VS Code.
2.  Ejecuta el siguiente comando:
    ```powershell
    ./configurar-java.ps1
    ```
3.  **Reinicia VS Code** (ciérralo y ábrelo de nuevo).
4.  Verifica que funcionó escribiendo:
    ```powershell
    java -version
    ```
    Debería decir "openjdk version 17...".

## Opción B: Manual

Si prefieres hacerlo tú mismo:

1.  Presiona la tecla `Windows`, escribe **"Editar las variables de entorno del sistema"** y ábrelo.
2.  Haz clic en el botón **"Variables de entorno..."**.
3.  En la sección de arriba (**Variables de usuario para ASUS**):
    *   Si existe `JAVA_HOME`, selecciónala y dale a **Editar**.
    *   Si no existe, dale a **Nueva**.
4.  Configura los valores:
    *   **Nombre de la variable:** `JAVA_HOME`
    *   **Valor de la variable:** `C:\Program Files\Android\Android Studio\jbr`
5.  Busca la variable `Path` (en la misma sección de arriba), selecciónala y dale a **Editar**.
6.  Dale a **Nuevo** y escribe: `%JAVA_HOME%\bin`
7.  Dale a **Aceptar** en todas las ventanas.
8.  Reinicia VS Code.
