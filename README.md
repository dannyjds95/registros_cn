# registros familia
HOST: gateway01.us-east-1.prod.aws.tidbcloud.com
PORT: 4000
USERNAME: 2ji5HdpY4sfmZMo.root
PASSWORD: tQPdtsQdqHSASOp6
DATABASE: registro_cn
CA: <CA_PATH>


# Comprobar qué archivos han cambiado
git status

# Preparar todos los archivos modificados
git add .

# Guardar los cambios con un mensaje
git commit -m "Actualizacion inicio"

# Enviar los cambios a GitHub
git push origin main

git add . && git commit -m "Agrega nuevas carpetas y archivos" && git push origin main