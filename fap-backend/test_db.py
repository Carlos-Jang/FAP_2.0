import mysql.connector
print('Module import success')

try:
    conn = mysql.connector.connect(
        host='125.6.44.31',
        port=3306,
        user='fap_user',
        password='fap_password123!',
        database='openpms'
    )
    print('Connection success!')
    conn.close()
except Exception as e:
    print('Connection failed:', e)