SSH="ssh -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -i $HOME/.ssh/id_rsa"
$SSH root@146.190.252.82 '
cd /var/www/bodyandsleeves
echo "=== pull ==="
git pull --ff-only 2>&1 | tail -6
echo "=== new files present now? ==="
ls src/lib/productFlags.ts && grep -c "is_new_arrival" src/app/shop/ShopClient.tsx
echo "=== build ==="
npm run build 2>&1 | tail -6
echo "=== restart ==="
pm2 restart bodyandsleeves --update-env >/dev/null 2>&1 && echo restarted
sleep 3
curl -s -o /dev/null -w "app HTTP %{http_code}\n" http://localhost:3000/
'


## pull on your droplet and deploy:
cd /var/www/bodyandsleeves
git pull --rebase
npm run build
pm2 restart bodyandsleeves
