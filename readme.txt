----------------------------------------
akani2984-netblocker
A severless net-wide dns request blocker and inspector for all your devices.
----------------------------------------

----------------------------------------
Introduction:
akani2984-netblocker allows you to inspect and block  dns requests of all your devices. 
It uses regexp rule to block requests.You can also load other people's rules urls, hosts file and plain domain lists are supported.
You can block dns request of your device you do not want, take back the  control right of your own devices.
----------------------------------------

----------------------------------------
About Third Party Block Lists:
There are two block list formarts supported:

Hosts:
127.0.0.1 abc.example.com
0.0.0.0 example.com

Plain Domain list:
abc.example.com
example.com

A lot of blocklists supports those formarts.You may search 'block list collection' by google/bing for blocklists you want. 
Please note that your blocklists can not too large(less than 50MiB is recommended).
----------------------------------------

----------------------------------------


----------------------------------------
How To Deploy:
Frok(github)/imoprt(gitlab) this project, then make it privite(You do not need to make it public for personal usage).
Create a new Cloudflare Pages project, from this project you cloned/imported. 
(Build command: npm run build)
(Output Dir: /dist)
----------------------------------------

----------------------------------------
If you want auto update for third party block lists:
Create a deploy hook of your pages project. Send POST requests to it through cron/systemd timer/secluded jobs/free cloud cron/tasker/macrodroid/iOS automation.
----------------------------------------

----------------------------------------
How To Use:
Change your DNS setting of your device to 'https://Your-Project-Domain/Your-Token' as DOH DNS. Default token is 'dns-query'.
----------------------------------------

----------------------------------------
How to Configure:
Access 'https://Your-Project-Domain/Your-Token' in browser to use UI to configure.
----------------------------------------

----------------------------------------
Inpect：
Use the real-time log function in cloudflare dashboard to inspect requests of your devices.
----------------------------------------

----------------------------------------
Compatibility of DOH ：

Android：
Do not support natively. You may want to use singbox in VPN lockdown mode to set a doh dns for android.

IOS:
Yes,through configuration profile.

Windows 11/MacOS:
Yes ,just change the dns in settings.

Linux:
Feel free to do  it yourself.

Router:
Some routers supports doh dns. If you point your router's dns to a doh dns, all your devices connected to your router will use it. No need to set doh dns per device.
----------------------------------------

----------------------------------------
Force Apps to use your own DOH DNS:
You may use sing-box. 
On Linux/MacOS/Windows/OpenWRT, register it as a system service, and make sure it will auto restart less than 1 second when terminated. 
On  Android/IOS , lock down singbox's VPN.
Confing example:

{
  "log": {
    "level": "debug",
    "timestamp": true
  },
    "dns": {
    "servers": [
      {
        "tag": "bootstrap",
        "type": "udp",
        "server": "1.1.1.1",
      },
      {
        "type": "fakeip",
        "tag": "fakeip",
        "inet4_range": "198.18.0.0/15",
        "inet6_range": "fc00::/18"
      },
      {
        "tag": "doh",
        "type": "https",
        "server": "your-project-domain",
        "domain_resolver": "bootstrap",
        "path": "your-token"
      }
    ],
    "strategy": "ipv4_only",
    "final": "doh",
    "disable_cache": false,
     "rules": [
      {
        "query_type": [
          "A",
          "AAAA"
        ],
        "server": "fakeip"
      }
    ]
  },
  "inbounds": [
    {
      "type": "tun",
      "interface_name": "tun0",
      "address": ["172.17.0.1/30"],
      "mtu": 200,
      "auto_route": true,
      "strict_route": true,
      "stack": "mixed",
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "block",
      "tag": "block"
    }
  ],
   "route": {
    "auto_detect_interface": true,
    "rules": [
      {
        "action": "sniff"
      },
      {
        "protocol": "dns",
        "action": "hijack-dns"
      },
      { "port": [853], "outbound": "block" }
    ],
    "default_domain_resolver": "doh",
    "final": "direct"
  }
}

A more aggressive config, for sing-box 1.13.21:
{
  "log": {
    "level": "debug",
    "timestamp": true
  },
    "dns": {
    "servers": [
      {
        "tag": "bootstrap",
        "type": "udp",
        "server": "1.1.1.1",
      },
      {
        "type": "fakeip",
        "tag": "fakeip",
        "inet4_range": "198.18.0.0/15",
        "inet6_range": "fc00::/18"
      },
      {
        "tag": "doh",
        "type": "https",
        "server": "your-project-domain",
        "domain_resolver": "bootstrap",
        "path": "your-token"
      }
    ],
    "strategy": "ipv4_only",
    "final": "doh",
    "disable_cache": false,
     "rules": [
      {
        "query_type": [
          "A",
          "AAAA"
        ],
        "server": "fakeip"
      }
    ]
  },
  "inbounds": [
    {
      "type": "tun",
      "interface_name": "tun0",
      "address": ["172.17.0.1/30"],
      "mtu": 200,
      "auto_route": true,
      "strict_route": true,
      "stack": "mixed",
    }
  ],
  "outbounds": [
    {
      "type": "direct",
      "tag": "direct"
    },
    {
      "type": "block",
      "tag": "block"
    }
  ],
   "route": {
    "auto_detect_interface": true,
    "rules": [
      {
        "action": "sniff"
      },
      {
        "protocol": "dns",
        "action": "hijack-dns"
      },
      { "port": [853], "outbound": "block" },
      { "ip_cidr": "0.0.0.0/0", "outbound": "block" }
    ],
    "default_domain_resolver": "doh",
    "final": "direct"
  }
}
----------------------------------------

----------------------------------------
Todo List:
Producetion ready
----------------------------------------
