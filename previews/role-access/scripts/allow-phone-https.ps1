# Run from an administrator PowerShell window.
New-NetFirewallRule -DisplayName 'agriMAINT HTTPS phone test' -Direction Inbound -Action Allow -Protocol TCP -LocalAddress 192.168.10.216 -LocalPort 8443 -RemoteAddress LocalSubnet -Profile Private,Domain
