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

## git pull --rebase on prod
git pull --rebase
npm run build
pm2 restart bodyandsleeves --update-env


##GitHub has all the commits. The droplet pulled successfully but the build 
##might be serving stale .next cache. Can you SSH into the droplet and run:
cd /var/www/bodyandsleeves
rm -rf .next
npm run build
pm2 restart bodyandsleeves --update-env

##The rm -rf .next forces a completely clean build — no cached chunks
##from a previous build that might be serving the old nav.



##The file on the droplet still has the old label. 
##Git pull didn't update it. Run:

cd /var/www/bodyandsleeves
git fetch origin
git reset --hard origin/main
npm run build
pm2 restart bodyandsleeves --update-env

##'git reset --hard origin/main' forces the droplet to exactly match GitHub,
##overwriting any local divergence.

====================================
pm2 delete bodyandsleeves
cd /var/www/bodyandsleeves
pm2 start npm --name bodyandsleeves -- start
pm2 save

=====================================Force a fresh deploy
cd /var/www/bodyandsleeves
git pull
npm ci
npm run build

cp -r node_modules/sharp .next/standalone/node_modules/
cp -r node_modules/@img .next/standalone/node_modules/

pm2 delete bodyandsleeves
pm2 start node --name bodyandsleeves -- .next/standalone/server.js
pm2 save
=========================================

Now push this and redeploy on the droplet:

# on your local machine
git add scripts/deploy.sh && git commit -m "fix deploy: copy static assets and public to standalone" && git push

# then on the droplet
cd /var/www/bodyandsleeves && git pull && bash scripts/deploy.sh


The missing cp -r .next/static and cp -r public is what broke the formatting — CSS,
JS chunks, fonts, and images all live in those folders and the standalone server 
can't find them without the copy.