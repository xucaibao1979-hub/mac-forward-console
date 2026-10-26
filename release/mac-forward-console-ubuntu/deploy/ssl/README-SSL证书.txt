AURA机器人中控台：内网SSL证书部署

一、在服务器执行
cd /opt/weixin/mac-forward-console-ubuntu
chmod +x deploy/ssl/install-internal-ssl.sh
bash deploy/ssl/install-internal-ssl.sh 192.168.1.77

二、访问地址
https://192.168.1.77/

三、让Windows浏览器不再提示“不安全”
1. 从服务器取回以下文件：
   /opt/weixin/mac-forward-console-config/ssl/aura-internal-ca.crt
2. 双击证书，选择“安装证书”。
3. 选择“本地计算机”。
4. 选择“将所有证书放入下列存储”。
5. 选择“受信任的根证书颁发机构”。
6. 完成后彻底关闭并重新打开浏览器。

注意：
1. 只能把 aura-internal-ca.crt 安装到客户端，绝对不要复制 aura-internal-ca.key。
2. CA私钥和服务器证书保存在程序发布目录之外，更新代码不会覆盖。
3. 重复执行安装脚本会保留原内部CA，只重新签发服务器证书。
4. 如果以后有正式域名，建议改用公开受信任的ACME证书。
