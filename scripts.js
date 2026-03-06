/* --- STATE VARIABLES --- */
let mode = 'std', origin = 'CW', special = { STR: 5, PER: 5, END: 5, CHA: 5, INT: 5, AGI: 5, LCK: 5 };
let currentSort = 'az';
const sKeys = ["STR", "PER", "END", "CHA", "INT", "AGI", "LCK"];
const skills = ["BARTER", "BIG GUNS", "ENERGY WEAPONS", "EXPLOSIVES", "GUNS", "LOCKPICK", "MEDICINE", "MELEE WEAPONS", "REPAIR", "SCIENCE", "SNEAK", "SPEECH", "SURVIVAL", "UNARMED"];

/* --- PERSISTENCE OBJECT --- */
let regionalStorage = { 'CW': { quests: [], colls: [] }, 'MW': { quests: [], colls: [] } };

/* --- PERK DATA (from Nuclear Sunset Perk Sheet) --- */
const PERKS_DATA = [{"name": "(Inexplicable) Feminist Agenda", "req": "Level 6, NOT Lady Killer, NOT Confirmed Bachelor, CHR 4, INT 5, PER 6", "ranks": 1, "desc": "Something stirs within you - something *interdisciplinary*. Is it a newly formed reaction to getting your head ventilated by a dashing rogue, or something you've always had? One thing is for sure: you're not a *mild* feminist. You're ready to let loose, on each and every member of the un-fairer sex! +Women appreciate your attitude. +5 Speech and Barter when speaking to women. +5% damage against men."}, {"name": "A Solitary Soul", "req": "Level 10", "ranks": 1, "desc": "Traveling with a crowd just isn't for you. When not accompanied by any companions, you recover 10% more health from healing sources, gain 15% more experience, and while facing more than one target at once, the adrenaline rush from any non-fatal critical hit will restore the hit's health damage by 2% per point of Endurance, if you have an equal amount of AP available."}, {"name": "A Stranger I Remain", "req": "Level 2, CHR < 6", "ranks": 1, "desc": "You don't belong here; the fewer factions that know of you, the higher your sneak bonus. (+26 Sneak,  reduced by 2 for each faction that knows you)"}, {"name": "Action Star", "req": "Level 4, AGL 5", "ranks": 3, "desc": "The life of an action star is an exciting one! As your career develops, you'll be able to choose to improve your total AP, your AP regeneration rate, or your weapon AP cost. If you take all three ranks, your AP is restored by an amount equal to your luck on each headshot outside of Bullet Time as well!"}, {"name": "Ain't Like That Now", "req": "Level 50, NOT Thought You Died, NOT Just Lucky I'm Alive, Evil Karma", "ranks": 1, "desc": "Maybe you were bad once, but you ain't like that now. Your Karma has been reset, you regenerate AP 20% faster, and your attack speed is increased by 20%. You are also 25% less susceptible to critical hits from Evil or Very Evil characters."}, {"name": "Alertness", "req": "Level 2, INT 5, PER 5", "ranks": 1, "desc": "You've learned to keep your senses alert to any danger. When crouched and not moving you gain a +2 to your Perception attribute to help you find enemies before they find you."}, {"name": "And Stay Back", "req": "Level 50, Guns 70, Shotgun Surgeon", "ranks": 1, "desc": "You've discovered a Shotgun technique that has a chance to knock an enemy back on any hits that penetrate the target's DT. Slugs have a much greater chance to cause knockdown."}, {"name": "Anodized Armor", "req": "Level 10, Science 40", "ranks": 1, "desc": "Holding onto all those scrap electronics has begun to magnetize your armor. When wearing any metal armor and carrying 10+ scrap electronics, your item condition is reduced by 35%, and you gain +8% DR."}, {"name": "Anodized Arsenal", "req": "Level 16, Anodized Armor, Ener. Weap. 65, Science 50", "ranks": 1, "desc": "You've devised a way to focus the anodized charge of your armor into your energy weapons. While wearing your metal armor and carrying your scrap electronics and an additional 3+ fission batteries, your energy weapon projectile speed is increased by 25%, and you gain 25% DT penetration with energy weapons."}, {"name": "Applied Ballistics", "req": "Level 12, STR 7, INT 5, Guns 60 or Explos. 60", "ranks": 1, "desc": "Your experience with conventionally sized weaponry has taught you fundamental skills that can be applied to more powerful weapons. You've gained +25 Big Guns."}, {"name": "Atom Bomb Baby", "req": "Level 8, STR < 9, END 8 or AGL 8, Big Guns 50", "ranks": 1, "desc": "It's hard to operate heavy weaponry while also wearing heavy armor! You gain increased equip and reload speed (30,20,10%), as well as increased Big Guns (+15/10/5), while wearing clothes/light, medium, or heavy (non-power) armors."}, {"name": "Atomic!", "req": "Level 20, END 6", "ranks": 1, "desc": "With the Atomic! perk, you are 25% faster and stronger whenever you're basking in the warm glow of radiation. Outside irradiated areas, your Action Points regenerate faster and faster the higher your level of radiation sickness becomes."}, {"name": "Automatic Artistry", "req": "Level 10, PER 4", "ranks": 1, "desc": "Automatic Artistry reduces your spread with automatic weapons by 15% and increases our crit. chance with them by 10%."}, {"name": "Avant Apocalypse", "req": "Level 4", "ranks": 1, "desc": "Fashion clearly didn't hit its peak until *after* the war. When wearing Raider Armor, you gain +2 Endurance, +1 Strength, +25 AP, and your Unarmed and Melee Weapon AP cost is reduced by 15%."}, {"name": "Balanced Load", "req": "Level 2, STR 6 or PER 6 or END 6", "ranks": 1, "desc": "You're experienced with leverage and fulcrums. With a little attention to the finer details, you've gained +10% carry weight, which increases to 15% when your weapon is holstered. Your backpack AP regen penalty will also be reduced by one tier."}, {"name": "Better Criticals", "req": "Level 16, PER 6, LCK 6", "ranks": 1, "desc": "With the Better Criticals perk, you gain a 3% critical damage bonus per point of Perception."}, {"name": "Big Iron", "req": "Level 14, AGL 8, Guns 60", "ranks": 1, "desc": "Like the legendary ranger of old, your handgun handling is extraordinary - only when you face your opponent in a fair fight. During combat, while not sneaking and using a ballistic handgun, you gain +20% draw speed, as well as +35% attack speed for three seconds after unholstering your weapon."}, {"name": "Blade In The Shadow", "req": "Level 2, Melee Weap. 30, Sneak 30", "ranks": 1, "desc": "You're most devastating when unnoticed. Your bladed weapon attacks gain +10 damage while outside of your target's line of sight, and another +10 and +50% crit. damage if they are also outside of combat."}, {"name": "Blood Bag", "req": "Level 2, END 7, Survival 25", "ranks": 1, "desc": "You're a universal donor in a world that needs blood transfusions more than ever. You gain an extra blood bag when using a blood draw kit, and your recovered health is increased by 25% and you gain extra AP regeneration while under the effect of a blood bag or blood draw kit."}, {"name": "Blue Moon", "req": "Level 24, PER 7, LCK 7", "ranks": 1, "desc": "Under the calming gaze of the moon, from 9PM-5AM, you gain +5% crit. chance and +50% crit. damage while also using a scope."}, {"name": "Blunt Force Trauma", "req": "Level 6, STR 7, Melee Weap. 35 or Unarmed 35", "ranks": 2, "desc": "Blunt Force Trauma increases your crit. chance and attack speed with blunt weapons by 10%, and the second rank increases your crit. dramage by 15% and your damage by an additional 15%."}, {"name": "Boiadero", "req": "Level 10, CHR 5, Survival 35", "ranks": 1, "desc": "Smoking, Courier. It will take a lot of tobacco-smoking for you to become a *boiadeiro*. In these wild, uncultured times, with a gun in one hand and two unfiltered cigarettes in the other, you make your own rules. +5 Crit Chance while holding 10+ individual cigarettes. +5 Speech while holding 8+ cigarette packs. +1 Charisma while holding 5+ cigarette cartons."}, {"name": "Bolt-Action Hero", "req": "Level 8, PER 7, AGL 5 , Guns 65", "ranks": 2, "desc": "Rack'em up! Bolt-action weapons gain 10% attack speed and +5 DT penetration. The second rank grants a 15% damage bonus and 5% faster attack speed."}, {"name": "Boozer", "req": "Level 16, END 6, INT < 6", "ranks": 1, "desc": "When under the effects of alcohol, your addiction duration is halved, and prives are reduced by 10%."}, {"name": "Boxer", "req": "Level 6, AGL 5, END 5, Unarmed 35", "ranks": 1, "desc": "You gotta roll with the punches. You've gained +10% attack speed with unarmed weapons, and +1 unarmed damage per point of Agility."}, {"name": "Broad Daylight", "req": "Level 10, Sneak 50", "ranks": 1, "desc": "You're so sneaky that you can sneak even with your Pip-Boy light on! Any time the Pip-Boy light is on, you gain a sneak bonus to offset the light's sneak penalty."}, {"name": "Buck Wild", "req": "Level 25, AGL 8, Guns 75", "ranks": 1, "desc": "It may not be mating season, but when you've got four walls around you and a shotgun in your hand, you're the most aggressive stag in the pack! Your shotgun spread, attack speed, and damage are all increased by 25% while in an interior."}, {"name": "Burden to Bear", "req": "Level 16, Strong Back, STR 8, END 8", "ranks": 1, "desc": "With the Burden To Bear perk, you can carry 4 more pounds of equipment for each point of both Strength and Endurance, on top of your Strong Back carry weight bonus."}, {"name": "Burning Sensation", "req": "Level 10, END 8", "ranks": 1, "desc": "Your anamolous body chemistry immediately rejects radiation, at the cost of your health. While you are irradiated, you will lose one point of health and disperse three points of radiation per second. This may be fatal!"}, {"name": "Burning Wasteland Sun", "req": "Level 14, END 6, Ener. Weap. 50", "ranks": 1, "desc": "Can you feel that blazing sun, beating down on you? Then your fire weapons have +8% crit. chance and +15% crit. damage, and they deal bonus limb and fatigue damage!"}, {"name": "Butcher", "req": "Level 8, Melee Weap. 35, Evil Karma", "ranks": 1, "desc": "Chop that meat! Thanks to your sadistic tendencies, you now gain bonus XP and restore action points when you cripple or dismember a limb, regardless of whether the target is living or dead. You also gain +20% non-power attack speed with one-handed melee weapons!"}, {"name": "Card Counter", "req": "Level 16, I Don't Believe In Luck, PER 9, INT 7", "ranks": 1, "desc": "All it takes is a keen eye and the discretion to not call attention to yourself. +Dramatically better results when gambling."}, {"name": "Center of Mass", "req": "Level 14, Ener. Weap. 70 or Guns 70 or Big Guns 70", "ranks": 1, "desc": "You don't fool around with fancy trick shots. Straight to the midsection and down they go. In Bullet Time, you do an additional 15% damage with attacks targeting the torso, and torso limb damage that you deal will be doubled."}, {"name": "Certified Tech", "req": "Level 24, INT 5, Science 60, Repair 60", "ranks": 1, "desc": "Your knowledge of robotic components allows you to break them more easily and salvage their mechanical corpses. You have a +25% chance to score critical hits against robots, and you'll also find more useful components on robots you destroy."}, {"name": "Chainsaw Carnage", "req": "Level 24, Butcher", "ranks": 1, "desc": "A hefty cleaver may hew bone, but you're starting to need high-volume viscera to fulfill your violent delights. You deal +20% damage with automatic melee weapons like the Chainsaw, and when you kill a target using such a weapon, you will gain +10 DT for four seconds and time will slow for a short duration. (The Thermic Lance does not qualify.)"}, {"name": "Chemist", "req": "Level 14, Med. 60", "ranks": 1, "desc": "With the Chemist perk, any chems you take last twice as long."}, {"name": "Clothes Make The Courier", "req": "Level 8, INT 7", "ranks": 1, "desc": "Since the time of Erasmus, people have known that dressing sharply is the key to success! While wearing clothing, you gain _10% XP, +7 to Barter, Speech, and Sneak, and suffer -50% limb damage."}, {"name": "Coiled Snake", "req": "Level 10, AGL 8, Survival 35", "ranks": 1, "desc": "You're extra dangerous when cornered or unseen. You gain +15% throwing velocity and attack speed with thrown melee weapons while crouched, as well as +25% movement speed and +15% attack speed while prone."}, {"name": "Cola Comrade", "req": "Level 8", "ranks": 1, "desc": "Sunset Sarsparilla may be nice, but when need that kick, Cola is the only thing that cuts it. When you drink Nuka-Colas, you gain +4% crit chance for two minutes. Special variants can also provide you extra permanent max health, carry weight, AP, or random skill bonuses."}, {"name": "Collective Consciousness", "req": "Level 20, CHR 6", "ranks": 1, "desc": "You're a master of manipulation. As you gain positive repuation with each faction, your Speech increases by +2 for each faction that likes you, and your Barter purchase prices are also reduced by 2% each if your karma is Evil or Very Evil."}, {"name": "Combustion Kid", "req": "Level 6, AGL 6, Explos. 30", "ranks": 1, "desc": "Wait, where did you get that grenade from? You gain +25% equip speed and +15% attack speed with throwable explosives and the detonator."}, {"name": "Commando", "req": "Level 12, PER 6, Guns 40 or Ener. Weap. 40 or Big Guns 40", "ranks": 2, "desc": "While using a rifle (or similar two-handed weapon), your accuracy is increased by 15% with each rank of the Commando perk."}, {"name": "Concentrated Fire", "req": "Level 18, Ener. Weap. 60 or Guns 60 or Big Guns 60", "ranks": 1, "desc": "With Concentrated Fire, your accuracy when targeting any body part in Bullet Time increases slightly with each subsequent attack on that body part, and your spread is decreased by 20% when using an automatic weapon."}, {"name": "Contents Under Pressure", "req": "Level 10, Explos. 50", "ranks": 2, "desc": "You're absolutely bursting at the seams with pyrotechnic pressure! While using a ranged fire-based weapon, you gain +20% attack speed, at the cost of 15% more condition damage. The second rank reduces the condition damage by 5%, and increases the attack speed bonus by 5%."}, {"name": "Cowboy", "req": "Level 10, Guns 45, Melee Weap. 25", "ranks": 1, "desc": "When using any cowboy weapon, your attack speed, accuracy, and damage are increased by 15%."}, {"name": "Critter Cruncher", "req": "Level 2, STR 6 or END 6", "ranks": 1, "desc": "The puny creatures of the wasteland can hardly scratch you. You suffer 50% less limb damage when being attacked by an insect or an animal, and you deal 50% more damage to them with your bare fists."}, {"name": "Cyborg", "req": "Level 14, Med. 60, Science 60", "ranks": 1, "desc": "You've made permanent enhancements to your body! The Cyborg perk instantly add +10% to your Poison, Radiation, Energy, and Fire resistances."}, {"name": "Cyborg Justice", "req": "Level 16, Cyborg, AGL 8, Melee Weap. 75, Science 50", "ranks": 1, "desc": "Your cybernetically enhanced arms vibrate your blade so finely that it can't be perceived by the naked eye. You've gained +15 DT penetration and doubled limb damage when using a bladed weapon, and +15% damage when attack a robot with your bladed weapon."}, {"name": "Daddy's Boy/Girl", "req": "Level 2, INT 6", "ranks": 3, "desc": "Just like dear old Dad, you've devoted your time to intellectual pursuits. With each rank, hacking gets easier and you use chems 10% more effectively."}, {"name": "Death Wish", "req": "Level 2", "ranks": 1, "desc": "The elation of feeling yourself at the precipice of death gives you a rush unlike any other. When an enemy lands a critical hit on you, you have a Luck based chance to receive an XP bonus equal to the damage dealt by that hit."}, {"name": "Deep Sleep", "req": "Level 6, Survival 30", "ranks": 1, "desc": "You sleep deeply no matter where you are. You get the Well Rested benefit no matter what bed you sleep in."}, {"name": "Demolition Expert", "req": "Level 6, Explos. 40", "ranks": 2, "desc": "With each rank of this perk, all of your Explosives weapons do an additional 10% damage and have 10% larger area of effect."}, {"name": "Desperado", "req": "Level 12, PER 7, Cowboy or Sweet Six Shooter", "ranks": 1, "desc": "You're a true desperado with impeccable precision. When using a cowboy weapon, you gain a crit. chance bonus that scales with your Perception (1% per point), an additional 3% crit. chance bonus if you're alone and facing more than three enemies at once, and you deal +20% damage against targets using ranged cowboy weapons."}, {"name": "Devil's Advocate", "req": "Level 14, CHR 8, Evil Karma", "ranks": 1, "desc": "You're most convincing when you lie; people immediately mistrust you when you're being truthful. You've gained +25 Speech, but only while your karma is Very Evil."}, {"name": "Direct Modes of Taxation", "req": "Level 12, PER 6, LCK 3, Barter 65", "ranks": 1, "desc": "You're the tax collector; the cold, icy grip of death won't part you from the money left on the bodies of NCR and Legion members. +Chance to find more NCR and Legion money on the bodies of their respective factions. +Perception-based chance to add NCR and Legion money to targets you hit with Unarmed strikes."}, {"name": "Discus Champ", "req": "Level 2, STR 5, Explos. 25", "ranks": 1, "desc": "There's nobody quite as good at throwing heavy, flat objects as you are! Your thrown mines travel with 2x/1.75x/1,5x speed while moving forward/backwards/sideways, respectively. You also gain +50% attack speed with mines, which increases to +75% while moving!"}, {"name": "Duck and Cover", "req": "Level 2, INT 5", "ranks": 1, "desc": "When danger threatens you, you never get hurt, you know just what to do! Duck.. and cover! You've gained 15% damage resistance against explosions."}, {"name": "Duelist", "req": "Level 10", "ranks": 1, "desc": "Fight'em on fair ground. When you kill a human or ghoul using a weapon of the same skill as you, you gain +15XP. For every 150 kills in this manner per each weapon type, you will gain +1 to that skill."}, {"name": "Entomologist", "req": "Level 4, Survival 45, INT 4", "ranks": 1, "desc": "With the Entomologist perk, you do an additional +50% damage every time you attack a mutated insect, like the Radroach, Giant Mantis, or Radscorpion, and you are able to find more of their parts in loot."}, {"name": "Extracurricular Knowledge", "req": "Level 10", "ranks": 1, "desc": "Selecting Extracurricular Knowledge will allow you to save a perk point for later, but you will be forced to take a new trait. This can be done multiple times. Your perk point can be used by activating this perk in the Pip-Boy."}, {"name": "Eye for An Eye", "req": "Level 4, LCK 5", "ranks": 1, "desc": "While your head is crippled, you gain an additional +25 crit damage and crit chance."}, {"name": "Fast Metabolism", "req": "Level 12, END 5, Survival 25", "ranks": 1, "desc": "With the Fast Metabolism perk, you gain a 20% Health bonus when using Stimpaks. Alcohol will also reduce your radiation twice as quickly."}, {"name": "Fatal Counter", "req": "Level 30, PER 5, STR 5, Unarmed 75 or Melee Weap. 75", "ranks": 1, "desc": "You're excellent at capitalizing on your enemy's vulnerabilities. When using unarmed or melee, you deal double damage and have doubled critical chance when attacking an enemy that has been staggered by a block/"}, {"name": "Ferocious Loyalty", "req": "Level 6, CHR 6", "ranks": 1, "desc": "The power of your personality inspires die-hard loyalty from your followers. When you drop below 50% Health, your companions gain much greater resistance to damage."}, {"name": "Fight Hungry", "req": "Level 2, Survival 20", "ranks": 1, "desc": "Desperation if your strongest motivator. In combat, when you have advanced or greater starvation, you gain +10% damage and +1 Endurance. "}, {"name": "Fight the Power!", "req": "Level 10", "ranks": 1, "desc": "You've had enough of the so-called \"authorities\" pushing poor folks around! You gain +2 DT, and +5% Critical Chance against anyone wearing the faction armor of the NCR, Legion, Enclave, or Brotherhood."}, {"name": "Finesse", "req": "Level 10, AGL 5", "ranks": 1, "desc": "With the Finesse perk, you have a higher chance to score a critical hit on an opponent in combat, equivalent to 5 extra points of Luck."}, {"name": "Fortune Finder", "req": "Level 6, LCK 5, Survival 35", "ranks": 1, "desc": "With the Fortune Finder perk, you'll find considerably more bottle caps in containers than you normally would. You can also punch locked containers with no weapon equipped to check if there is anything inside!"}, {"name": "Freeze!", "req": "Level 2, PER 5 or Trigger Discipline", "ranks": 1, "desc": "Hands in the air! Keep'em there! Don't move a muscle! One wrong move, and I'll blow you away, punk! +25% accuracy in Bullet Time while not moving. -15% accuracy outside of Bullet Time."}, {"name": "Friction Addiction", "req": "Level 8, END 7", "ranks": 1, "desc": "The best offense is a good defense, and you're at your toughest when taking punishment. You gain +1 DT and your enemy crit. chance is reduced by 3% per each point in Strength while you're blocking, and a percentage of your action points are restored each time you are hit. ((Luck / 20) * Max AP)"}, {"name": "Friend of the Night", "req": "Level 2, PER 7, Sneak 40 or Survival 40", "ranks": 1, "desc": "You are a true friend of the night. Your eyes adapt quickly to low-light conditions indoors and when darkness falls across the wastelands."}, {"name": "Full Metal Jacket", "req": "Level 18, Grunt, PER 7, END 6", "ranks": 1, "desc": "Full Metal Jacket grants 8 DT penetration, 10% crit. chance, +15% reload speed, and -15% enemy crit. chance when using a Grunt weapon and wearing medium armor."}, {"name": "Gallows Humor", "req": "Level 2, PER 5 , CHR 5, Evil Karma", "ranks": 1, "desc": "You know just the right time to \"lighten\" the mood with a dark joke. +10 Speech and Barter for 30 seconds after killing something. +25% increased XP and +1 Charisma for 30 seconds after killing something if you have an Evil or Very Evil companion."}, {"name": "Ghastly Scavenger", "req": "Level 12, Cannibal, END 8", "ranks": 1, "desc": "With Ghastly Scavenger, when you're in Sneak mode, you gain the option to eat a Super Mutant or Feral Ghoul corpse to regain Health equal to your Survival skill. If this act is witnessed, it is considered a crime against nature."}, {"name": "Grim Reaper's Sprint", "req": "Level 14, LCK 6", "ranks": 2, "desc": "If you kill a target in Bullet Time, 20 Action Points are restored upon exiting Bullet Time. The second rank increases the amount to 60."}, {"name": "Grunt", "req": "Level 10, Guns 45, Explos. 25, Melee Weap. 20", "ranks": 1, "desc": "Just good, honest infantry work! When using U.S. Army weapons, your Explosives, Unarmed, and Melee Weapons gain +15% damage, your Unarmed and Melee Weapons gain +25% equip speed, your automatic weapon spread is reduced by 20%, your semi-automatic spread is reduced by 10%, you gain +15% reload speed, and Strength requirements are reduced by 1."}, {"name": "Gun Guru", "req": "Level 10, INT 6, Guns 60", "ranks": 1, "desc": "You're so good with brass and powders that they'd hire you at the Gun Runners as a reloader. You gain +30 Repair while using a physical Reloading Bench."}, {"name": "Gun Nut", "req": "Level 2, INT 4, Repair 30, Guns 30", "ranks": 3, "desc": "You're obsessed with using and maintaining a wide variety of conventional firearms. With each rank of the Gun Nut perk, when using a gun, spread and item condition damage are reduced by 5%."}, {"name": "Gunshots N' Drop Shots", "req": "Level 6, AGL 5, PER 5", "ranks": 1, "desc": "Your acuity while under the effects of alcohol is nothing short of legendary. You no longer suffer a spread penalty while drunk."}, {"name": "Gunslinger", "req": "Level 6, Guns 40 or Ener. Weap. 40", "ranks": 2, "desc": "While using a one-handed waepon, your accuracy is increased by 15% per rank."}, {"name": "Hand Loader", "req": "Level 12, Repair 60, Guns 50 or Big Guns 50", "ranks": 1, "desc": "You know your way around a reloading bench and don't let good brass and hulls go to waste. When you use Guns, you are more likely to recover cases and hulls. Your reloading recipes also require less powder, and you also have access to advanced ammo types at the Reloading Bench."}, {"name": "Handgun Hotshot", "req": "Level 10, Guns 40 or Big Guns 40 or Ener. Weap. 40", "ranks": 2, "desc": "The Handgun Hotshot perks grants 5 DT penetration to ballistic handguns and 15% attack speed with non-automatic, ballistic handguns. The second rank grants an additional +20% damage, at cost of increasing Strength requirements by 1."}, {"name": "Hardy", "req": "Level 6, END 5, Survival 25", "ranks": 1, "desc": "The natural healing power of the human body is your greatest resource. While your Hunger and.or Dehydration are over 150, you gain +15 Survival and +15% to recovered health."}, {"name": "Headhunter", "req": "Level 28, PER 8, Guns 75 or Ener. Weap. 75 or Big Guns 75", "ranks": 2, "desc": "You take your time to ensure that your bullets will land right between your target's eyes. You gain +25% chance to hit your target's head in Bullet Time, at cost of 50% increased AP cost. The second rank increases your reload speed while prone by 25%, and your crit. damage while attacking your target's head in Bullet Time by 15%."}, {"name": "Headless Courier", "req": "Level 10, Survival 50", "ranks": 1, "desc": "Ride on through the night, chasing the perfect helmet that doesn't exist. When not wearing any headgear, your head takes half damage and you gain +2 Perception."}, {"name": "Healing Factor", "req": "Level 8, END 8, LCK 8", "ranks": 1, "desc": "The radiation in your body, combined with your unique genetics, has allowed you to develop a strange treatment which has made your body slowly heal your limbs up to full any time they're damaged, at the cost of increasing all of your needs while you heal."}, {"name": "Heave, Ho!", "req": "Level 2, STR 5 or AGL 6, Explos. 25 or Melee Weap. 25", "ranks": 1, "desc": "Quite an arm you've got there. All of your thrown weapons gain 25% velocity and damage while holding the aim key."}, {"name": "Heavy Gunner", "req": "Level 12, STR 8 or AGL 6, Big Guns 55, Guns 30", "ranks": 1, "desc": "While using Big Guns, Heavy Gunner grants +15% improved equip speed and Bullet Time chance to hit, -20% movement spread penalty, and your automatic weapon spread is reduced by 5% per second while continuously firing, to a max of 025%."}, {"name": "Heavyweight", "req": "Level 8, STR 7 or END 7", "ranks": 1, "desc": "Have you been working out? Weapons heavier than 10lbs now weight half as much for you. (Modified weapons that drop below 10lbs. will not gain this benefit.)"}, {"name": "Hidden Weapons", "req": "Level 8, Survival 35 or Sneak 40", "ranks": 1, "desc": "Whether your weapon jams, or it gets shot out of your hand, you'll be ready. Basic holdout weapons are granted additional 5/10/15/20/25/30/35% crit. chance and damage for 0-15/16-25/26-35/36-50/51-65/66-80/81-100 points in the Survival skill. Your equip speed with basic holdout weapons is also increased by 35%."}, {"name": "High Roller", "req": "Level 30, LCK 7", "ranks": 1, "desc": "All those chips have got you feeling lucky! You gain +2% critical chance per when holding 2500+ Tops, Ultra-Luxe, Sierra Madre, Atomic Wrangler, or Gomorrah chips, up to a maximum of 10%."}, {"name": "Hit the Deck", "req": "Level 12, Explos. 50", "ranks": 1, "desc": "Your familiarity with Explosives allows you to avoid a portion of their damage. Your DT is increased by 15 against all explosives."}, {"name": "Hobbler", "req": "Level 12, PER 7", "ranks": 1, "desc": "With the Hobbler perk, your attacks to legs deal double limb damage, your run speed is increased by 10% with each crippled leg, and you gain +5 DT penetration and 25% better chance to hit an opponent's legs in Bullet Time."}, {"name": "Home on the Range", "req": "Level 6, Survival 35", "ranks": 1, "desc": "Whenever you interact with a campfire, you have the option of sleeping, with all the benefits that sleep brings."}, {"name": "Hunter", "req": "Level 2, PER 4, Survival 30", "ranks": 1, "desc": "In combat, you do +50% critical damage against animals and mutated animals, and +50% damage against them while using guns and sneaking. You're also able to collect their meat more often."}, {"name": "Immaculate Coiffure", "req": "Level 6, CHR 7", "ranks": 1, "desc": "All of your time spent styling your bespoke bob has left you clinging to your precious few remaining bobby pins. You gain +3 Lockpick for each missing bobby pin as your total diminishes below 9. (+24 Lockpick max)"}, {"name": "Impact Play", "req": "Level 10, Masochist, STR 3, END 7", "ranks": 1, "desc": "At first it was just bleeding that got your heart racing, but you've developed a taste for more percussive punishment. Each time you are hit with an Unarmed or Melee Weapon, you gain +10% DR for 15 seconds, up to a maximum of +50%."}, {"name": "Implant GRX", "req": "Level 30, END 8", "ranks": 2, "desc": "You gain a non-addictive subdermal Turbo (chem) injector. This perk may be taken twice, with the second rank increased the effect from 2 to 3 seconds and the uses per day from 5 to 10. [Activated in the Pip-Boy inventory.]"}, {"name": "In Shining Armor", "req": "Level 2, Repair 40, Science 30", "ranks": 1, "desc": "Beams reflect off the mirror-like finish of your gleaming armor! You gain an additional +5 DT against energy weapons while wearing any metal armor, and +2 while wearing reflective eyewear."}, {"name": "Indirect Bartering", "req": "Level 2, STR 6", "ranks": 1, "desc": "You're not actually threatening any violence, but anybody with a pair of eyes can tell that you could if you chose to. You gain +1 to Barter and Speech for each point of STR while your Karma is Evil or Very Evil."}, {"name": "Inertial Dampening", "req": "Level 20, AGL 8, END 8", "ranks": 1, "desc": "You've learned to avoid damage by diving away from it at just the right time. Whenever you're in the air, you gain +7 DT and +20% DR."}, {"name": "Infighter", "req": "Level 12, PER < 8", "ranks": 1, "desc": "If you can't see the whites of their eyes, you can't put a bullet between them. While close to your target, your DT is increased by 5 and damage is improved by 10%, your enemey's crit. chance is reduced by 30%, and their DT is reduced by 5."}, {"name": "Intense Training", "req": "Level 2, AGL < 10 or CHR < 10 or END < 10 or LCK < 10 or PER < 10 or INT < 10 or STR < 10", "ranks": 10, "desc": "With the Intense Training perk, you can put a single point into any of your SPECIAL attributes."}, {"name": "Iron Fist", "req": "Level 4, STR 4, END 5, Unarmed 25", "ranks": 2, "desc": "With each rank of the Iron Fist perk, you deal +1 Unarmed Damage per rank of Endurance."}, {"name": "Iron Focus", "req": "Level 24, END 8, Big Guns 75", "ranks": 1, "desc": "Iron Focus grants 10% DR while aiming with any ranged weapon, as well as -20% spread and +25% crit. chance while aiming with Big Guns."}, {"name": "Irradiated Beauty", "req": "Level 6, END 6, CHR 4", "ranks": 1, "desc": "When doused in radiation, your natural aura is enhanced. You gain +1 Charisma at 250/450/650 rads."}, {"name": "Junk Rounds", "req": "Level 2, INT 6, Repair 25", "ranks": 1, "desc": "Survival is the mother of invention! Craft ammo at the Reloading Bench using alternate materials (Scrap Metal and Tin Cans)."}, {"name": "Jury Rigging", "req": "Level 24, Repair 90, INT 7", "ranks": 1, "desc": "You possess the amazing ability to repair any item using a roughly similar item. Fix a Trail Carbine with a Hunting Rifle, a Plasma Defender with a Laser Pistol, or even Power Armor with Metal Armor. How does it work? Nobody knows... except you."}, {"name": "Just Lucky I'm Alive", "req": "Level 50, NOT Thought You Died, NOT Ain't Like That Now, Neutral Karma", "ranks": 1, "desc": "You've had lots of close calls. Whenever you finish a fight with less than 25% Health, your Luck increases by +4 for 3 minutes. You're also -25% as likely to be critically hit, and your own critical hits inflict +25% damage."}, {"name": "Laser Commander", "req": "Level 18, Ener. Weap. 75", "ranks": 1, "desc": "From the humble Laser Pistol to the mighty Gatling Laser, you do +15% damage and have +10 chance to critically hit with any laser weapon."}, {"name": "Lawbringer", "req": "Level 14, Good Karma", "ranks": 1, "desc": "Once you have the Lawbringer perk, any evil character you kill will have a finger on their corpse. This finger can then be sold to a certain person (whose identity is disclosed when you take the perk) for caps and positive Karma."}, {"name": "Lead Belly", "req": "Level 2, Survival 40 or END 7", "ranks": 2, "desc": "With each rank of the Lead Belly perk, you take 25% less radiation when consuming irradiated food and drink. You will also no longer suffer SPECIAL penalties when consuming raw meat. "}, {"name": "Life Giver", "req": "Level 12", "ranks": 1, "desc": "With the Life Giver perk, you and your companions gain an additional 30 health. The value of your Medicine and Survival skills will also be doubled when using a Doctor's Bag or Medkit on a companion."}, {"name": "Light Step", "req": "Level 6, Sneak 40", "ranks": 1, "desc": "With the Light Step perk, your chance to set off mines and floor-based traps while sneaking is reduced by 10% per point of Agility. This effect is multiplicative, with a minimum chance to set off traps of 35%."}, {"name": "Light Touch", "req": "Level 6, STR < 6, AGL 6", "ranks": 1, "desc": "Heavy armor just isn't your thing, so you've learned to customize light armor for maximum benefit. While wearing light armor or clothing, you gain +3 DT and DR, +15% AP regeneration speed and your enemies suffer a -25% Critical Hit chance."}, {"name": "Little Leaguer", "req": "Level 2, STR 4, Melee Weap. 25", "ranks": 3, "desc": "Years as the Vault little league MVP have honed your hitting and throwing. With each rank, you gain +10% damage when using bats and nail boards, and you throw grenades 10% harder and farther."}, {"name": "Living Anatomy", "req": "Level 12, Med. 70", "ranks": 1, "desc": "Living Anatomy allows you to see the Health and DT of any target. It also gives you a +5% bonus to damage against Humans and non-feral Ghouls, and allows you to collect resources from abominations."}, {"name": "Long Haul", "req": "Level 12, END 8, Survival 75", "ranks": 1, "desc": "You have learned how to pack mountains of gear for the Long Haul. Being over-encumbered no longer prevents you from using Fast Travel."}, {"name": "Lucky Number", "req": "Level 4", "ranks": 1, "desc": "\"Luck is an accident that happens to the confident.\" Your resolute confidence in your Lucky Number manifests in the ability to fire a weapon with a single projectile with ideal accuracy when your ammo count matches your current luck."}, {"name": "Mad Bomber", "req": "Level 6, Repair 40, Explos. 35", "ranks": 1, "desc": "Your intimate knowledge of gadgets and explosives have combined to make you... the Mad Bomber! Your crafting requirements for throwables explosives are reduced by 35."}, {"name": "Mad Science", "req": "Level 40, INT 8, Science 80, Ener. Weap. 75", "ranks": 1, "desc": "Harness the power of your intellect with the Mad Science perk! You've gained 15% damage, reload speed, and attack speed with mad science weapons, and your Luck is increased by 1 for the duration of combat for each critical kill you deal in battle, up to a max of +10."}, {"name": "Magnetic Personality", "req": "Level 16, CHR < 10", "ranks": 1, "desc": "Your presence seems to compel others to follow you! With this perk, you can have one more active companion in your party. However, you still cannot have more than five companions at once."}, {"name": "Marathon Runner", "req": "Level 10, Survival 45", "ranks": 1, "desc": "With the Marathon Runner perk, you no longer suffer movement speed penalties when wearing medium or heavy armor, and you move 10% faster when wearing light or no armor."}, {"name": "Martyr", "req": "Level 20, CHR 8", "ranks": 1, "desc": "When struck, you're inclined to simply turn the other cheek, rather than strike back. Your divine Luck grants you a small chance for each wound's health loss to be partially restored."}, {"name": "Master Trader", "req": "Level 26, CHR 7, Barter 50, Speech 50", "ranks": 1, "desc": "When you take the Master Trader perk, you gain a 3% discount per 10 points in Speech."}, {"name": "Math Wrath", "req": "Level 14, Science 70 or INT 8", "ranks": 1, "desc": "You are able to optimize your Pip-Boy's Bullet Time logic, reducing all AP costs by 5% per each 10 points in Science above 40. Charging your Pip-Vision will also be twice as efficient."}, {"name": "Maze Runner", "req": "Level 10, AGL 6, INT 6", "ranks": 1, "desc": "You're most agile when cornered; you gain +10% movement speed while indoors and not sneaking. You also gain an additional +2 Agility while in combat in an interior."}, {"name": "Meltdown", "req": "Level 16, Ener. Weap. 90", "ranks": 1, "desc": "Meltdown grants you +25% crit. damage with plasma weapons, and critical hits on targets wearing metallic armor will heavily damage their armor and reduce their resistances."}, {"name": "Metacarpal Mayhem", "req": "Level 50, STR 8, END 8, Unarmed 100", "ranks": 1, "desc": "Your fists are practically weapons of mass destruction! Your unarmed power attack speed is increased 15%, your unarmed crit chance increases with your Strength, and your unarmed crit damage increases with Endurance, both applying a multiplicative x1.01 per point, up to a maximum of +21%."}, {"name": "Mister Sandman", "req": "Level 6, Sneak 50, AGL 8", "ranks": 1, "desc": "With the Mister Sandman perk, when you're in Sneak mode, you gain the option to silently kill any human or Ghoul while they're sleeping, and you gain bonus XP when doing so."}, {"name": "Monkey Wrench", "req": "Level 6, Repair 60", "ranks": 1, "desc": "You're familiar enough with robots that taking them apart is a snap --- doubly so if you don't care about putting them back together again. You deal 50% more damage against robots when using melee weapons."}, {"name": "My Own Master Now", "req": "Level 10, Shunned by NCR, Legion, and Strip", "ranks": 1, "desc": "You've worked under the shackles of the wasteland factions long enough! You're your own master! You gain +1 Endurance, and for each faction that dislikes you, you gain +1 damage, and -1% limb damage."}, {"name": "Nerd Rage!", "req": "Level 10, Science 75", "ranks": 1, "desc": "You've been pushed around long enough! Whenever your health drops below 20%, enemy crit. chance is reduced by 10% for each point of Intelligence you have."}, {"name": "Nerves of Steel", "req": "Level 26, AGL 6, END 4", "ranks": 2, "desc": "With the Nerves of Steel perk, you regenerate Action Points 20% faster per rank."}, {"name": "Ninja", "req": "Level 20, Sneak 80, Melee Weap. 80 or Unarmed 80", "ranks": 1, "desc": "The Ninja perk grants you the power of the fabled shadow warriors. When attacking with either Melee or Unarmed, you gain a +15% critical chance on every strike. Sneak attack criticals do 25% more damage than normal."}, {"name": "Non-Combatant", "req": "Level 2", "ranks": 1, "desc": "It's not your fight, you're just trying to stay alive. You gain +8 DT and +15% DR while your weapon is holstered in combat."}, {"name": "Notorious E.V.I.L.", "req": "Level 16, Miss Fortunte or Mysterious Stranger, Evil Karma", "ranks": 1, "desc": "While you are Evil or Very Evil, Miss Fortune and the Mysterious Stranger will appear to help you twice as often."}, {"name": "Nowhere To Hide", "req": "Level 2, PER 6", "ranks": 1, "desc": "Where do you think you're going? Nobody gets away. You deal double damage to fleeing targets, and +50% damage to cloaked targets."}, {"name": "Nuclear Anomaly", "req": "Level 50, END 10", "ranks": 1, "desc": "With the Nuclear Anamoly perk, whenever your Health is reduced to 20 or less, you will erupt into a devastating nuclear explosion. Note that any allies in the vicinity will also suffer the effects of the blast!"}, {"name": "Nuka Chemist", "req": "Level 14, Science 65", "ranks": 1, "desc": "You have unraveled some of the greatest mysteries of Pre-War masters: formulas for developing special Nuka-Colas! This perk unlocks special Nuka-Cola recipes at the Workbench."}, {"name": "Old World Gourmet", "req": "Level 2, END 6, Survival 45", "ranks": 1, "desc": "Thanks to wasteland living, you've learned the secrets of the pre-war scroungers! You've gained +25% Addiction Resistance, and a healing bonus from junk food and pre-war liquor."}, {"name": "Overkiller", "req": "Level 18, STR 8, Big Guns 80, Melee Weap. 80", "ranks": 1, "desc": "Big guns, big muscles, big melee. When using a heavy melee weapon, you gain +15% damage, +20% power attack damage, and any hits that cripple a limb will knock your target down."}, {"name": "Overt Coercion", "req": "Level 24, STR 6, CHR < 5, Indirect Bartering, Evil Karma", "ranks": 1, "desc": "Implication and insinuation has given way to explicit threats. Each point of STR above 5 grants -5% to purchase prices while your karma is Evil or Very Evil, up to a maximum of -25%."}, {"name": "Overwhelming Odds", "req": "Level 16, INT 8", "ranks": 1, "desc": "You've learned how to tilt the odds in your favor when outnumbered. Your weapon damage and Bullet Time accuracy are increased by 15%, and you gain +5 DT penetration while fighting a group of five or more enemies."}, {"name": "Pack Rat", "req": "Level 30, INT 6, Survival 80", "ranks": 1, "desc": "You have learned the value of careful packing. Items with a weight of 2 or less weigh half as much for you."}, {"name": "Party Hard", "req": "Level 8, Survival 30 or END 6", "ranks": 1, "desc": "Your ruthless party momentum allows you to ignore the negative effects of alcohol."}, {"name": "Piercing Strike", "req": "Level 12, STR 7, Unarmed 50 or Melee Weap. 50", "ranks": 1, "desc": "Piercing Strike makes all of your Unarmed and Melee Weapons (including thrown) negate 2 points of DT on the target per point in Strength. Bleeding effects that you afflict to enemies will also be the maximum severity."}, {"name": "Plasma Spaz", "req": "Level 10, Ener. Weap. 70, AGL 5", "ranks": 1, "desc": "You're just so excited about plasma that you can't (magnetically) contain yourself! Your attack speed and AP cost with plasma weapons are improved by 20%."}, {"name": "Play With Fire", "req": "Level 2, END 5, Explos. 25", "ranks": 1, "desc": "You've got a habit of playing with fire; your burns have increased your fire resistance. You've gained +15% fire resistance and +10% attack speed while using a fire-based weapon."}, {"name": "Prohibition", "req": "Level 2, PER < 6, INT < 6", "ranks": 1, "desc": "They're still out there. Looking for booze... your booze. You're not sure who \"they\" are, the only way they'll take it is from your cold, dead hands! -1 Intelligence while under the effects of alcohol. +10 Barter while under the effects of alcohol. +10 Barter while holding 10 or more bottles of alcohol."}, {"name": "Puppies!", "req": "Level 2, LCK 8", "ranks": 1, "desc": "With the Puppies! perk, if Dogmeat dies, you'll be able to get a new canine companion from his litter of puppies. Just wait a bit, and you'll find your new furry friend waiting outside Vault 101."}, {"name": "Purifier", "req": "Level 14", "ranks": 1, "desc": "As a purifier of the wasteland, you do +50% damage with Melee and Unarmed weapons against Centaurs, Nightstalkers, Spore Plants, Spore Carriers, Deathclaws, Super Mutants, and Feral Ghouls."}, {"name": "Pyromaniac", "req": "Level 12, Ener. Weap. 60", "ranks": 1, "desc": "With the Pyromaniac perk, you do +50% damage and afterburn damage with fire-based weapons, like the Flamer and Shishkebab."}, {"name": "Quick Draw", "req": "Level 8, AGL 5", "ranks": 1, "desc": "Quick Draw makes all of your weapon equipping and holstering 10% faster per each points in the appropriate weapon skill above 30."}, {"name": "Quick Pockets", "req": "Level 4, AGL 4, Ener. Weapon. 25 or Guns 25 or Big Guns 25 or Unarmed 25 or Melee Weap. 25 or Explos. 25", "ranks": 1, "desc": "You have learned to more quickly utilize your throwables. This perk grants +20% equip speed and +40% attack speed for a few seconds after equipping a throwable via Quick Select."}, {"name": "Rad Absorption", "req": "Level 14, END 7 or Survival 50", "ranks": 1, "desc": "With the Rad Absorption perk, your radiation level dissipates by 1 point every 10 seconds."}, {"name": "Rad Child", "req": "Level 20, Survival 75", "ranks": 1, "desc": "You truly are a rad child. As you go through the increasingly devastating stages of radiation sickness, you will regenerate more and more health while actively being irradiated by higher intensities of radiation."}, {"name": "Rad Resistance", "req": "Level 8, Survival 40, END 5", "ranks": 1, "desc": "Rad Resistance allows you to -- what else? -- resist radiation. This perks grants an additional 25% to Radiation Resistance."}, {"name": "Radiation Renegade", "req": "Level 8, Science 50", "ranks": 1, "desc": "Why forgo radiation protection in favor of damage protection when you could have both? While wearing a radiation suit, you gain the following benefits: +10% Carry Weight, +10 DT/+20% DR, +25 AP, -20% Limb Damage, -25% enemy crit. chance. You also don't suffer a sneaking detection penalty while running!"}, {"name": "Rapid Reload", "req": "Level 8, AGL 5, Guns 40 or Ener. Weap. 40 or Big Guns 40", "ranks": 2, "desc": "Rapid Reload makes all of your weapon reloads 15% faster."}, {"name": "Red Sun", "req": "Level 10, Ener. Weap. 40", "ranks": 1, "desc": "Can you feel the rays of the glorious sunshine? When you're charged by the rays of the sun (outside, 7AM-7PM) your laser weapons will penetrate 5 DT and gain a moderate damage bonus which increases the further away your target is. (+3-7 damage)"}, {"name": "Repair Rascal", "req": "Level 6, Survival 40, Repair 40", "ranks": 2, "desc": "Repair Rascal grants +15% damage, equip, and attack speed with repair-related weapons, and reduces their strength requirement by 1. The second rank grants an additional +10% damage and crit. damage, and +15% crit. chance."}, {"name": "Retention", "req": "Level 2, INT 6", "ranks": 1, "desc": "With the Retention perk, the bonuses granted by skills magazines last three times as long."}, {"name": "Return To Ashes", "req": "Level 6, END 7, Ener. Weap. 50 or Explos. 50", "ranks": 1, "desc": "Your flames burn hotter than anyone else's! You gain +50% damage when you and your enemy are both using fire-based weapons."}, {"name": "Rigorous Self Critique", "req": "Level 8, Evil Karma", "ranks": 1, "desc": "Your hands may not be clean, but with lots of soap and a chance in behavior, you can wash away your past to start anew. +1/2 Strength while Good/Very Good. -2 Endurance while Evil/Very Evil. Your XP will be penalized whenever you lose karma, in an amount equal to the magnitude of the change multiplied by your Intelligence."}, {"name": "Road Rage", "req": "Level 12, END 6, Guns 35, Unarmed 25, Survival 50", "ranks": 1, "desc": "Redden the road, release the rage! With the Road Rage perk, you gain +25 attack speed, +10% damage, and -10% spread when using knuckle weapons, Chinese/.32 pistols, tire irons, throwing spears, single and double-barrel shotguns, lead pipes, and other wasteland weapons."}, {"name": "Robotics Expert", "req": "Level 12, Science 50, INT 5", "ranks": 1, "desc": "With the Robotics Expert perk, you do an additional 7% damage per 10 points in Science above 50 to robots. In addition, activating a hostile robot while undetected will allow you to put that robot into a permanent shutdown state."}, {"name": "Rolling With The Punches", "req": "Level 2, END 5, Unarmed 25", "ranks": 1, "desc": "When your fists are out, you float like a bloatfly. You gain +12% speed for 5 seconds whenever you're hit by a melee attack with an unarmed weapon equipped. (This effect does NOT stack)"}, {"name": "Run n' Gun", "req": "Level 8, Guns 45 or Ener. Weap. 45 or Big Guns 45", "ranks": 1, "desc": "The Run n' Gun perk reduces spread penalties while moving by 50%."}, {"name": "Saguaro Stalker", "req": "Level 12, Sneak 50, Survival 50", "ranks": 1, "desc": "Like the silent spectres of the Sonoran desert, you blend in most effectively when staying still. You gain +10 Sneak, +15% silenced weapon crit. chance, and +15% damage against targets which do not have you anywhere in their line of sight while not moving."}, {"name": "Scoundrel", "req": "Level 4, CHR 7", "ranks": 3, "desc": "Take the Scoundrel perk, and you can use your wily charms to influence people. With each rank, vendors give an 8% discount, and you gain extra XP for passing speech checks."}, {"name": "Scrounger", "req": "Level 8, Survival 50, LCK 3", "ranks": 1, "desc": "With the Scrounger perk, you'll find considerably more ammunition in containers than you normally would."}, {"name": "Servant of Chaos", "req": "Level 8", "ranks": 1, "desc": "You swear loyalty to no creed, no culture, and no crown. As a Servant of Chaos, you will gain XP anytime your karma changes in the opposite direction of your current alignment, equal to the degree of the change."}, {"name": "Sharpshooter", "req": "Level 30, PER 10", "ranks": 1, "desc": "Your visual acuity borders on clairvoyance. With this perk, the spread of all ranged weapons is decreased by 25%."}, {"name": "Shell Shock", "req": "Level 8, AGL 6, Guns 50", "ranks": 1, "desc": "You've always got a shotgun handy for close encounters, and you'll never get caught with it unloaded. You've gained +35% equip speed and +25% reload speed with shotguns."}, {"name": "Shotgun Surgeon", "req": "Level 10, Guns 45, PER 6", "ranks": 2, "desc": "Your precision with a scattergun is something to behold. When using shotguns, each rank of Shotgun Surgeon grants you 6 points of DT penetration and -8% spread."}, {"name": "Silent Running", "req": "Level 6, AGL 6, Sneak 50", "ranks": 2, "desc": "With the Silent Running perk, running no longer factors into a successful sneak attempt. The second rank grants an additional +2% sneaking speed per each 10 points in Sneak."}, {"name": "Sixgun Samurai", "req": "Level 30, AGL 9, Guns 80, Melee Weap. 80", "ranks": 1, "desc": "Your first hit on a weapon after drawing a revolver will cause the target to drop a one-handed weapon or jam a two-handed weapon. If you hit their right arm, it will cripple it instead. Your first sword hit after switching off a revolver will have 2x crit. chance and crit. damage. If it's a power attack, it will instead deal +50% damage. Your first revolver hit after switching off a sword will penetrade 10 DT and guarantee a crit."}, {"name": "Size Matters", "req": "Level 4, STR 5, Big Guns 30", "ranks": 3, "desc": "You're obsessed with really big weapons. With each rank of this perk, you gain 10% better accuracy, reload and equip speed when using Big Guns."}, {"name": "Slayer", "req": "Level 20, AGL 7, STR 7, Unarmed 70 or Melee Weap. 70", "ranks": 2, "desc": "The slayer walks the earth! Each rank of the Slayer perk increases the speed of all your Melee Weapons and Unarmed Attacks by 20%."}, {"name": "Sleepwalker", "req": "Level 2, END 4, AGL 4", "ranks": 1, "desc": "Left foot, right foot. Left leg, right leg. Once you get going, you can practically sleep on your feet. While walking or running at night, you recover sleep deprivation, at a rate of 1 per 2 seconds of walking."}, {"name": "Slick Shooter", "req": "Level 10, INT 7", "ranks": 1, "desc": "You know to target an enemy when they're most vulnerable. You gain a 50% boost to your crit. chance while your target is reloading."}, {"name": "Sneaking Tiger", "req": "Level 16, END 4, AGL 8, Sneak 50", "ranks": 1, "desc": "Lithe and nimble, you move so quickly that you only take glancing hits. While crouched and moving, you gain +1 DT per point of Agility up to 5, and +2 DT for each point of Agility above 5."}, {"name": "Sneering Imperalist", "req": "Level 8, Evil Karma", "ranks": 1, "desc": "You don't take kindly to raiders, junkies, or tribals trying to \"settle\" or \"stay alive\" in civilized lands. Against drity raider, slaver, and junkie types, as well as tribals, you do +15% damage and have a bonus to hit in Bullet Time."}, {"name": "Sniper", "req": "Level 28, PER 8, Guns 75 or Ener. Weap. 75 or Big Guns 75", "ranks": 1, "desc": "With the Sniper perk, your chance to hit an opponent's head in Bullet Time is increased by 25%, and your crit. chance is increased by 25% while using a scope and crouched."}, {"name": "Social Drinker", "req": "Level 2, CHR 8", "ranks": 1, "desc": "You're not drinking to get drunk, you're drinking to have a good time with your friends. You have -20% addiction chance when traveling with at least one companion."}, {"name": "Soda Sommelier", "req": "Level 6, Survival 40, Repair 40", "ranks": 1, "desc": "200 years of desolation hasn't drained the taste of good ol' soda pop. In fact, some say it tastes better when it's flat! You gain a bonus to max health and heal extra health when drinking any bubbly drink."}, {"name": "Splash Damage", "req": "Level 12, Explos. 60", "ranks": 1, "desc": "When you're deep in enemy territory, you just start chucking grenades and hope for the best. All Explosives have a 25% larger area of effect."}, {"name": "Spotlight", "req": "Level 10, PER 8, CHR < 6, INT 7", "ranks": 1, "desc": "Your eyes pierce through people's lies. Each time you fail or succeed a particular dialog skill check for the first time, your Perception is increased by 1 and your Charisma is reduced by 1 for three minutes. Additionally, for every 2 successful checks per 1 failed check, you will gain a permanent +1 to Speech."}, {"name": "Stay Frosty", "req": "Level 12, Ener. Weap. 60", "ranks": 1, "desc": "With the Stay Frosty perk, cryogenic weapons do 50% more damage and the effects last 50% longer."}, {"name": "Steel Jacketed", "req": "Level 10, STR 7", "ranks": 1, "desc": "Yours is a heavy burden, and you need the heaviest of armors to survive it. While in non-powered heavy armor, you gain +25% carry weight, +1 Endurance, +10% combat movement speed, and +15% Unarmed and Melee Weapon damage."}, {"name": "Stonewall", "req": "Level 8, END 7, STR 7", "ranks": 1, "desc": "You gain +1 DT against all Melee Weapons and Unarmed attacks per point in Endurance, and immunity to knockdowns."}, {"name": "Strong Back", "req": "Level 6, STR 6, END 6", "ranks": 1, "desc": "With the Strong Back perk, you can carry 4 more pounds of equipment for each point of both Strength and Endurance, up to a maximum of +80lbs."}, {"name": "Strong Swimmer", "req": "Level 2, STR 4, END 4, AGL 6", "ranks": 1, "desc": "You're practically an irradiated mako shark! While not wearing power armor, you gain bonus swim speed based on your armor class up to a maximum of +25%. This bonus is reduced by 5% for medium and heavy armors while diving."}, {"name": "Sucker Punch", "req": "Level 2, AGL 6, Sneak 40, Unarmed 40", "ranks": 1, "desc": "Get'em while they're not looking! You gain +15 unarmed damage if your target is not in combat, or you are out of their line of sight. This bonus increases by +10 if your karma is Evil or Very Evil."}, {"name": "Suffer Well", "req": "Level 10, Last Laugh", "ranks": 1, "desc": "You're so delighted by laughing in the face of death that pain has become your greatest teacher. Whenever you lose health, you gain XP equal to the magnitude of health loss, multiplied by your Intelligence/100."}, {"name": "Super Slam", "req": "Level 12, STR 6, Melee Weap. 55 or Unarmed 55", "ranks": 1, "desc": "All Melee Weapons and Unarmed attacks have a chance to knock your target down when they penetrate the target's DT. This chance increases based on weapon weight and power attacking, and is proportionally reduced when a weapon's strength requirement is not met."}, {"name": "Survivalist", "req": "Level 10, END 6, Survival 75", "ranks": 1, "desc": "Material comforts and the buzz of conversation just aren't for you. With the Survivalist perk, actions which sate your hunger, thirst, and sleep deprivation will be twice as effective."}, {"name": "Sweet Six Shooter", "req": "Level 22, CHR 6, Guns 66, Good Karma", "ranks": 1, "desc": "The glint of your gun and the shine of your grin are nearly equal. You've gained access to powerful \"Blood\" revolver ammo recipes, along with 15% faster reload speed, 10% faster attack speed, +30% crit. chance and -60% weapon condition damage with revolvers while your Karma is Good or Very Good."}, {"name": "Swift Learner", "req": "Level 2, INT 4, PER 4", "ranks": 1, "desc": "The Swift Learner perk grants an additional 2% gained XP per point in Intelligence."}, {"name": "Swing For the Fences", "req": "Level 2, STR 6", "ranks": 1, "desc": "Knock'em right outta the park! Your attack speed with two handed melee weapons is increased by 8%, and you do an additional 7 points of damage while using any baseball bat."}, {"name": "Tag!", "req": "Level 16", "ranks": 1, "desc": "The Tag! perk allows you to select a fourth skill to be a tag skill, which will double the rate at which that skill advances."}, {"name": "Targeted Demolition", "req": "Level 16, PER 9, Big Guns 60, Explos. 60", "ranks": 1, "desc": "Targeted Demolition reduces explosive Big Guns' explosion radius by 20%, increases their attack speed by 20%, and increases their explosive projectile damage by 10%."}, {"name": "Tenacious", "req": "Level 8, END 7, LCK 3, Survival 50", "ranks": 1, "desc": "You've been bruised and scraped enough times to know how to give it your all when wounded. You gain improved movement speed with a crippled leg, improved gun spread with a crippled arm, +2 Endurance with a crippled torso, and improved chance to hit in Bullet Time with a crippled head."}, {"name": "That's Not a Knife", "req": "Level 4, END 5, Melee Weap. 30, Survival 30", "ranks": 1, "desc": "Your skin has been toughened by adversity and the wasteland sun. You gain +3 DT, an additional +1 DT per point in Endurance, when facing a target with a bladed weapon."}, {"name": "The Professional ", "req": "Level 6, Sneak 50", "ranks": 1, "desc": "Up close and personal, that's how you like it. Your Sneak Attack Criticals with pistols, revolvers, and submachine guns, whether Guns or Energy Weapons, all inflict an additional 20% damage."}, {"name": "Them's Good Eatin'", "req": "Level 8, Survival 75", "ranks": 1, "desc": "You've gained a chance to find a Thin Red Paste or Blood Sausage when looting any animal."}, {"name": "Thief", "req": "Level 2, AGL 6, Sneak 25", "ranks": 3, "desc": "With each rank of the Thief perk, you gain +5 Sneak and +5% pickpocket chance."}, {"name": "Thirsty", "req": "Level 2", "ranks": 1, "desc": "Something about the dehydration headaches makes you much more Charismatic. When you suffer any degree of dehydration, you gain +2 Charisma and a -10% reduction in buying prices."}, {"name": "This Is A Knife", "req": "Level 12, That's Not a Knife, STR 6, AGL 7, Melee Weap. 60", "ranks": 2, "desc": "Your enemy's crit chance is reduced by 20% and you gain +5 DT when you guard with a combat knife, bowie knife, or machete. The DT bonus doubles if your target is also wielding any handheld, bladed weapon. The second rank grants +10% attack speed and +15% damage with combat knives, bowies knives, and machetes."}, {"name": "Thought You Died", "req": "Level 50, NOT Just Lucky I'm Alive, NOT Ain't Like That Now, Good Karma", "ranks": 1, "desc": "Your storied past has fallen from memory 'cause everyone thought you died. Your Karma is reset, you inflict +15% damage against Evil or Very Evil characters, as well as being 25% less susceptible to their critical hits, and you gain +50 Health."}, {"name": "Threat Range", "req": "Level 8, STR 7, Melee Weap. 40", "ranks": 1, "desc": "When using a heavy melee weapon, you gain 10% attack speed and damage, and your DR is increased by 15% while you are attacking."}, {"name": "Toughness", "req": "Level 8, END 5", "ranks": 1, "desc": "With the Toughness perk, you gain +1 DT per point in Endurance."}, {"name": "Tribal Ways", "req": "Level 4, END 6, Survival 50", "ranks": 1, "desc": "Your limbs take 50% less damage from Animals, Mutated Animals, and Mutated Insects, and you gain +20 damage and attack speed with tribal weapons, as well as +8 DT, +25% DR, and +10% run speed while wearing a tribal outfit."}, {"name": "True Party Member", "req": "Level 10, AGL 4, Guns 35", "ranks": 1, "desc": "The proletariat majority may have passed, but your belief in the ideal stays true. You gain +30% attack speed, +25% crit. damage, and -30% spread with communist weapons, but your crit. chance is reduced by 20% when you are alone."}, {"name": "Truly Happy Medium", "req": "Level 10, END 7", "ranks": 1, "desc": "Not too heavy, not too light, you find that medium armors fit you just right! While wearing medium armor, your Health and AP are increased by 40, your enemies have -25% crit. chance, and your AP cost with ranged weapons is reduced by 20%."}, {"name": "Tunnel Runner", "req": "Level 8, AGL 8", "ranks": 1, "desc": "It's invaluable to keep your head down. Your movement speed is increased by 25% while sneaking in light armor with your weapon holstered."}, {"name": "Unstoppable Force", "req": "Level 12, STR 7, Melee Weap. 60 or Unarmed 60", "ranks": 1, "desc": "Your martial might is truly legendary. You do 4x damage through enemy blocks with all Melee Weapons and Unarmed attacks while moving forward."}, {"name": "Valkyrie", "req": "Level 8, AGL 7, Melee Weap. 50 or Unarmed 50", "ranks": 1, "desc": "You move so fast it's like you're sweating gasoline! In combat you gain +10% run speed, and gain +25% melee/unarmed attack speed whille on fire."}, {"name": "View To A Kill", "req": "Level 2, PER 6", "ranks": 1, "desc": "You're an avid learner of the battlefield. When you witness something get killed by a source other than yourself, you will gain XP equal to its level multiplied by your Perception. This amount doubles if your weapon is holstered."}, {"name": "Vigilant Recycler", "req": "Level 12, Science 70, Ener. Weap. 50", "ranks": 1, "desc": "Waste not, want not. When you use Energy Weapons, you are more likely to recover drained ammunition. You also have more efficient recycling recipes available at the Workbench."}, {"name": "Violent Vendetta", "req": "Level 8, PER 6", "ranks": 1, "desc": "You are the true apex of evolution. Those disgusting blue and green Super Mutants are nothing but an abomination. You've gained a 25% accuracy bonus when attacking Super Mutants in Bullet Time, as well as +25% damage against them."}, {"name": "Voyeur", "req": "Level 10, PER 7, Sneak 50", "ranks": 1, "desc": "If your targets could see your face in the moments before their grisly fate, they would die of fright before you even made a move. While within 30 yards of a target, for each second you look directly at a person who is unaware of you, your crit. damage will increase by 1%, up to a maximum of 25%. (Ranged weapons only gain half of this bonus.)"}, {"name": "Walker Instinct", "req": "Level 2, Survial 35, PER 3", "ranks": 1, "desc": "Your senses have become so keen that you can feel the slightest vibration in the ground. You gain +1 Perception and Agility attributes while outside and crouched."}, {"name": "Wasteland Masquerade", "req": "Level 2, PER 4, CHR 6, Speech 35", "ranks": 1, "desc": "\"The irony of life is that those who wear masks often show more truth than those without them.\" You gain +1 Charisma and Intelligence and gain +15% XP outside of combat while wearing headwear. (Exclusive from Headless Courier)"}, {"name": "Weapon Handling", "req": "Level 12, END 5, Survival 25", "ranks": 1, "desc": "You've become more accustomed to handling heavy weaponry. The Weapon Handling perk reduces weapon Strength requirements by 1, or by 2 if your weapon skill at least twice your weapon's requirement or greater than 95."}, {"name": "Western Standoff", "req": "Level 6, AGL 5, Guns 35 or Ener. Weap. 35 or Big Guns 35", "ranks": 1, "desc": "There's one way to guarantee that you have the upper hand in a fight; make sure you're the only one holding a weapon. You gain a +25% chance to hit an enemy's weapon in Bullet Time, which doubles if your target isn't in combat."}, {"name": "Winning Streak", "req": "Level 30, LCK 10", "ranks": 1, "desc": "Once your ticket comes up, you'll be on your way to the high-roller life. After you've scored a critical hit, your crit. chance is doubled."}, {"name": "Wolf In Sheep's Clothing", "req": "Level 10, Speech 40", "ranks": 1, "desc": "You're a master of disguise; while you wear the faction armor of a faction that you have negative repuation with, you will gain +2 Charisma, +10 Sneak, and +5 Critical Chance."}, {"name": "World In My Eyes", "req": "Level 8, PER 4, Guns 45 or Ener. Weap. 45 or Big Guns 45", "ranks": 1, "desc": "When you're sighting with a weapon, the only thing that matters is the world in front of you. You gain +3 Perception while aiming."}];


/* --- DATA: QUESTS --- */
const questsData = {
    'CW': { 
        'MAIN QUEST': ['<a href="https://fallout.fandom.com/wiki/Escape!" target="_blank">ESCAPE!</a>', '<a href="https://fallout.fandom.com/wiki/Following_in_His_Footsteps" target="_blank">FOLLOWING IN HIS FOOTSTEPS</a>', '<a href="https://fallout.fandom.com/wiki/Galaxy_News_Radio" target="_blank">GALAXY NEWS RADIO</a>', '<a href="https://fallout.fandom.com/wiki/Scientific_Pursuits" target="_blank">SCIENTIFIC PURSUITS</a>', '<a href="https://fallout.fandom.com/wiki/Tranquility_Lane" target="_blank">TRANQUILITY LANE</a>', '<a href="https://fallout.fandom.com/wiki/The_Waters_of_Life" target="_blank">THE WATERS OF LIFE</a>', '<a href="https://fallout.fandom.com/wiki/Picking_Up_the_Trail" target="_blank">PICKING UP THE TRAIL</a>', '<a href="https://fallout.fandom.com/wiki/Rescue_from_Paradise" target="_blank">RESCUE FROM PARADISE</a>', '<a href="https://fallout.fandom.com/wiki/Finding_the_Garden_of_Eden" target="_blank">FINDING THE GARDEN OF EDEN</a>', '<a href="https://fallout.fandom.com/wiki/The_American_Dream" target="_blank">THE AMERICAN DREAM</a>', '<a href="https://fallout.fandom.com/wiki/Take_it_Back!" target="_blank">TAKE IT BACK!</a>'],
        'SIDE QUEST': ['<a href="https://fallout.fandom.com/wiki/Agatha%27s_Song" target="_blank">AGATHA\'S SONG</a>', '<a href="https://fallout.fandom.com/wiki/Big_Trouble_in_Big_Town" target="_blank">BIG TROUBLE IN BIG TOWN</a>', '<a href="https://fallout.fandom.com/wiki/Blood_Ties" target="_blank">BLOOD TIES</a>', '<a href="https://fallout.fandom.com/wiki/Head_of_State" target="_blank">HEAD OF STATE</a>', '<a href="https://fallout.fandom.com/wiki/Oasis_(quest)" target="_blank">OASIS</a>', '<a href="https://fallout.fandom.com/wiki/Reilly%27s_Rangers_(quest)" target="_blank">REILLY\'S RANGERS</a>', '<a href="https://fallout.fandom.com/wiki/Stealing_Independence" target="_blank">STEALING INDEPENDENCE</a>', '<a href="https://fallout.fandom.com/wiki/Strictly_Business" target="_blank">STRICTLY BUSINESS</a>', '<a href="https://fallout.fandom.com/wiki/Tenpenny_Tower_(quest)" target="_blank">TENPENNY TOWER</a>', '<a href="https://fallout.fandom.com/wiki/The_Nuka-Cola_Challenge" target="_blank">THE NUKA COLA CHALLENGE</a>', '<a href="https://fallout.fandom.com/wiki/The_Power_of_the_Atom_(Fallout_3)" target="_blank">THE POWER OF THE ATOM</a>', '<a href="https://fallout.fandom.com/wiki/The_Replicated_Man" target="_blank">THE REPLICATED MAN</a>', '<a href="https://fallout.fandom.com/wiki/The_Superhuman_Gambit" target="_blank">THE SUPERHUMAN GAMBIT</a>', '<a href="https://fallout.fandom.com/wiki/The_Wasteland_Survival_Guide" target="_blank">WASTELAND SURVIVAL GUIDE</a>', '<a href="https://fallout.fandom.com/wiki/Those!" target="_blank">THOSE!</a>', '<a href="https://fallout.fandom.com/wiki/Trouble_on_the_Homefront" target="_blank">TROUBLE ON THE HOMEFRONT</a>', '<a href="https://fallout.fandom.com/wiki/You_Gotta_Shoot_%27Em_in_the_Head" target="_blank">YOU GOTTA SHOOT \'EM IN THE HEAD</a>'],
        'DLC: OPERATION ANCHORAGE': ['<a href="https://fallout.fandom.com/wiki/Aiding_the_Outcasts" target="_blank">AIDING THE OUTCASTS</a>', '<a href="https://fallout.fandom.com/wiki/The_Guns_of_Anchorage" target="_blank">THE GUNS OF ANCHORAGE</a>', '<a href="https://fallout.fandom.com/wiki/Paving_the_Way" target="_blank">PAVING THE WAY</a>', '<a href="https://fallout.fandom.com/wiki/Operation:_Anchorage!_(quest)" target="_blank">OPERATION: ANCHORAGE!</a>'],
        'DLC: BROKEN STEEL': ['<a href="https://fallout.fandom.com/wiki/Death_From_Above" target="_blank">DEATH FROM ABOVE</a>', '<a href="https://fallout.fandom.com/wiki/Shock_Value" target="_blank">SHOCK VALUE</a>', '<a href="https://fallout.fandom.com/wiki/Who_Dares_Wins" target="_blank">WHO DARES WINS</a>', '<a href="https://fallout.fandom.com/wiki/Holy_Water" target="_blank">HOLY WATER</a>', '<a href="https://fallout.fandom.com/wiki/Protecting_the_Water_Way" target="_blank">PROTECTING THE WATER WAY</a>', '<a href="https://fallout.fandom.com/wiki/The_Amazing_Aqua_Cura!" target="_blank">THE AMAZING AQUA CURA!</a>'],
        'DLC: THE PITT': ['<a href="https://fallout.fandom.com/wiki/Into_The_Pitt" target="_blank">INTO THE PITT</a>', '<a href="https://fallout.fandom.com/wiki/Unsafe_Working_Conditions" target="_blank">UNSAFE WORKING CONDITIONS</a>', '<a href="https://fallout.fandom.com/wiki/Free_Labor" target="_blank">FREE LABOR</a>'],
        'DLC: POINT LOOKOUT': ['<a href="https://fallout.fandom.com/wiki/The_Local_Flavor" target="_blank">THE LOCAL FLAVOR</a>', '<a href="https://fallout.fandom.com/wiki/Walking_with_Spirits" target="_blank">WALKING WITH SPIRITS</a>', '<a href="https://fallout.fandom.com/wiki/Hearing_Voices" target="_blank">HEARING VOICES</a>', '<a href="https://fallout.fandom.com/wiki/Thought_Control" target="_blank">THOUGHT CONTROL</a>', '<a href="https://fallout.fandom.com/wiki/A_Meeting_of_the_Minds" target="_blank">A MEETING OF THE MINDS</a>', '<a href="https://fallout.fandom.com/wiki/The_Velvet_Curtain" target="_blank">THE VELVET CURTAIN</a>', '<a href="https://fallout.fandom.com/wiki/An_Ancient_Heritage" target="_blank">AN ANCIENT HERITAGE</a>', '<a href="https://fallout.fandom.com/wiki/Plik%27s_Safari" target="_blank">PLIK\'S SAFARI</a>'],
        'DLC: MOTHERSHIP ZETA': ['<a href="https://fallout.fandom.com/wiki/Not_of_This_World_(quest)" target="_blank">NOT OF THIS WORLD</a>', '<a href="https://fallout.fandom.com/wiki/Among_the_Stars" target="_blank">AMONG THE STARS</a>', '<a href="https://fallout.fandom.com/wiki/This_Galaxy_Ain%27t_Big_Enough..." target="_blank">THIS GALAXY AIN\'T BIG ENOUGH...</a>']
    },
    'MW': { 
        'MAIN QUEST (GENERAL)': ['<a href="https://fallout.fandom.com/wiki/Ain%27t_That_a_Kick_in_the_Head_(quest)" target="_blank">AIN\'T THAT A KICK IN THE HEAD</a>', '<a href="https://fallout.fandom.com/wiki/Back_in_the_Saddle" target="_blank">BACK IN THE SADDLE</a>', '<a href="https://fallout.fandom.com/wiki/By_a_Campfire_on_the_Trail" target="_blank">BY A CAMPFIRE ON THE TRAIL</a>', '<a href="https://fallout.fandom.com/wiki/They_Went_That-a-Way" target="_blank">THEY WENT THAT-A-WAY</a>', '<a href="https://fallout.fandom.com/wiki/Ring-a-Ding-Ding!" target="_blank">RING-A-DING-DING!</a>'],
        'MAIN QUEST (INDEPENDENT)': ['<a href="https://fallout.fandom.com/wiki/Wild_Card:_Ace_in_the_Hole" target="_blank">WILD CARD: ACE IN THE HOLE</a>', '<a href="https://fallout.fandom.com/wiki/Wild_Card:_Change_in_Management" target="_blank">WILD CARD: CHANGE IN MANAGEMENT</a>', '<a href="https://fallout.fandom.com/wiki/Wild_Card:_You_and_What_Army%3F" target="_blank">WILD CARD: YOU AND WHAT ARMY?</a>', '<a href="https://fallout.fandom.com/wiki/Wild_Card:_Side_Bets" target="_blank">WILD CARD: SIDE BETS</a>', '<a href="https://fallout.fandom.com/wiki/Wild_Card:_Finishing_Touches" target="_blank">WILD CARD: FINISHING TOUCHES</a>', '<a href="https://fallout.fandom.com/wiki/No_Gods,_No_Masters" target="_blank">NO GODS, NO MASTERS</a>'],
        'MAIN QUEST (MR. HOUSE)': ['<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_I" target="_blank">THE HOUSE ALWAYS WINS I</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_II" target="_blank">THE HOUSE ALWAYS WINS II</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_III" target="_blank">THE HOUSE ALWAYS WINS III</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_IV" target="_blank">THE HOUSE ALWAYS WINS IV</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_V" target="_blank">THE HOUSE ALWAYS WINS V</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_VI" target="_blank">THE HOUSE ALWAYS WINS VI</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_VII" target="_blank">THE HOUSE ALWAYS WINS VII</a>', '<a href="https://fallout.fandom.com/wiki/The_House_Always_Wins_VIII" target="_blank">THE HOUSE ALWAYS WINS VIII</a>', '<a href="https://fallout.fandom.com/wiki/All_or_Nothing" target="_blank">ALL OR NOTHING</a>'],
        'MAIN QUEST (NCR)': ['<a href="https://fallout.fandom.com/wiki/Things_That_Go_Boom" target="_blank">THINGS THAT GO BOOM</a>', '<a href="https://fallout.fandom.com/wiki/Kings%27_Gambit" target="_blank">KINGS\' GAMBIT</a>', '<a href="https://fallout.fandom.com/wiki/For_the_Republic,_Part_2" target="_blank">FOR THE REPUBLIC, PART 2</a>', '<a href="https://fallout.fandom.com/wiki/You%27ll_Know_It_When_It_Happens" target="_blank">YOU\'LL KNOW IT WHEN IT HAPPENS</a>', '<a href="https://fallout.fandom.com/wiki/Eureka!" target="_blank">EUREKA!</a>'],
        'MAIN QUEST (LEGION)': ['<a href="https://fallout.fandom.com/wiki/Render_Unto_Caesar" target="_blank">RENDER UNTO CAESAR</a>', '<a href="https://fallout.fandom.com/wiki/Et_Tumor,_Brute%3F" target="_blank">ET TUMOR, BRUTE?</a>', '<a href="https://fallout.fandom.com/wiki/Arizona_Killer" target="_blank">ARIZONA KILLER</a>', '<a href="https://fallout.fandom.com/wiki/Veni,_Vidi,_Vici" target="_blank">VENI, VIDI, VICI</a>'],
        'SIDE QUESTS (MOJAVE)': ['<a href="https://fallout.fandom.com/wiki/A_Valuable_Lesson" target="_blank">A VALUABLE LESSON</a>', '<a href="https://fallout.fandom.com/wiki/Aba_Daba_Honeymoon" target="_blank">ABA DABA HONEYMOON</a>', '<a href="https://fallout.fandom.com/wiki/Ant_Misbehavin%27" target="_blank">ANT MISBEHAVIN\'</a>', '<a href="https://fallout.fandom.com/wiki/Anywhere_I_Wander" target="_blank">ANYWHERE I WANDER</a>', '<a href="https://fallout.fandom.com/wiki/Back_in_Your_Own_Backyard" target="_blank">BACK IN YOUR OWN BACKYARD</a>', '<a href="https://fallout.fandom.com/wiki/Beyond_the_Beef" target="_blank">BEYOND THE BEEF</a>', '<a href="https://fallout.fandom.com/wiki/Birds_of_a_Feather" target="_blank">BIRDS OF A FEATHER</a>', '<a href="https://fallout.fandom.com/wiki/Bitter_Springs_Infirmary_Blues" target="_blank">BITTER SPRINGS INFIRMARY BLUES</a>', '<a href="https://fallout.fandom.com/wiki/Booted" target="_blank">BOOTED</a>', '<a href="https://fallout.fandom.com/wiki/Boulder_City_Showdown" target="_blank">BOULDER CITY SHOWDOWN</a>', '<a href="https://fallout.fandom.com/wiki/Bye_Bye_Love" target="_blank">BYE BYE LOVE</a>', '<a href="https://fallout.fandom.com/wiki/Can_You_Find_it_in_Your_Heart%3F" target="_blank">CAN YOU FIND IT IN YOUR HEART?</a>', '<a href="https://fallout.fandom.com/wiki/Classic_Inspiration" target="_blank">CLASSIC INSPIRATION</a>', '<a href="https://fallout.fandom.com/wiki/Climb_Ev%27ry_Mountain" target="_blank">CLIMB EV\'RY MOUNTAIN</a>', '<a href="https://fallout.fandom.com/wiki/Come_Fly_With_Me" target="_blank">COME FLY WITH ME</a>', '<a href="https://fallout.fandom.com/wiki/Crazy,_Crazy,_Crazy" target="_blank">CRAZY, CRAZY, CRAZY</a>', '<a href="https://fallout.fandom.com/wiki/Cry_Me_a_River" target="_blank">CRY ME A RIVER</a>', '<a href="https://fallout.fandom.com/wiki/Debt_Collector" target="_blank">DEBT COLLECTOR</a>', '<a href="https://fallout.fandom.com/wiki/Don%27t_Make_a_Beggar_of_Me" target="_blank">DON\'T MAKE A BEGGAR OF ME</a>', '<a href="https://fallout.fandom.com/wiki/Eye_for_an_Eye" target="_blank">EYE FOR AN EYE</a>', '<a href="https://fallout.fandom.com/wiki/Eyesight_to_the_Blind" target="_blank">EYESIGHT TO THE BLIND</a>', '<a href="https://fallout.fandom.com/wiki/Flag_of_Our_Foul-Ups" target="_blank">FLAG OF OUR FOUL-UPS</a>', '<a href="https://fallout.fandom.com/wiki/G.I._Blues" target="_blank">G.I. BLUES</a>', '<a href="https://fallout.fandom.com/wiki/Ghost_Town_Gunfight" target="_blank">GHOST TOWN GUNFIGHT</a>', '<a href="https://fallout.fandom.com/wiki/Guess_Who_I_Saw_Today" target="_blank">GUESS WHO I SAW TODAY</a>', '<a href="https://fallout.fandom.com/wiki/Hard_Luck_Blues" target="_blank">HARD LUCK BLUES</a>', '<a href="https://fallout.fandom.com/wiki/High_Times" target="_blank">HIGH TIMES</a>', '<a href="https://fallout.fandom.com/wiki/How_Little_We_Know" target="_blank">HOW LITTLE WE KNOW</a>', '<a href="https://fallout.fandom.com/wiki/I_Don%27t_Hurt_Anymore" target="_blank">I DON\'T HURT ANYMORE</a>', '<a href="https://fallout.fandom.com/wiki/I_Put_a_Spell_on_You" target="_blank">I PUT A SPELL ON YOU</a>', '<a href="https://fallout.fandom.com/wiki/Keep_Your_Eyes_on_the_Prize" target="_blank">KEEP YOUR EYES ON THE PRIZE</a>', '<a href="https://fallout.fandom.com/wiki/Left_My_Heart" target="_blank">LEFT MY HEART</a>', '<a href="https://fallout.fandom.com/wiki/Medical_Mystery" target="_blank">MEDICAL MYSTERY</a>', '<a href="https://fallout.fandom.com/wiki/My_Kind_of_Town" target="_blank">MY KIND OF TOWN</a>', '<a href="https://fallout.fandom.com/wiki/No,_Not_Much" target="_blank">NO, NOT MUCH</a>', '<a href="https://fallout.fandom.com/wiki/Oh_My_Papa" target="_blank">OH MY PAPA</a>', '<a href="https://fallout.fandom.com/wiki/One_for_My_Baby" target="_blank">ONE FOR MY BABY</a>', '<a href="https://fallout.fandom.com/wiki/Pheeble_Will" target="_blank">PHEEBLE WILL</a>', '<a href="https://fallout.fandom.com/wiki/Pressing_Matters" target="_blank">PRESSING MATTERS</a>', '<a href="https://fallout.fandom.com/wiki/Restoring_Hope" target="_blank">RESTORING HOPE</a>', '<a href="https://fallout.fandom.com/wiki/Return_to_Sender" target="_blank">RETURN TO SENDER</a>', '<a href="https://fallout.fandom.com/wiki/Someone_to_Watch_Over_Me" target="_blank">SOMEONE TO WATCH OVER ME</a>', '<a href="https://fallout.fandom.com/wiki/Still_in_the_Dark" target="_blank">STILL IN THE DARK</a>', '<a href="https://fallout.fandom.com/wiki/Sunshine_Boogie" target="_blank">SUNSHINE BOOGIE</a>', '<a href="https://fallout.fandom.com/wiki/Talent_Pool" target="_blank">TALENT POOL</a>', '<a href="https://fallout.fandom.com/wiki/That_Lucky_Old_Sun" target="_blank">THAT LUCKY OLD SUN</a>', '<a href="https://fallout.fandom.com/wiki/The_Coyotes" target="_blank">THE COYOTES</a>', '<a href="https://fallout.fandom.com/wiki/The_Legend_of_the_Star" target="_blank">THE LEGEND OF THE STAR</a>', '<a href="https://fallout.fandom.com/wiki/The_Moon_Comes_Over_the_Tower" target="_blank">THE MOON COMES OVER THE TOWER</a>', '<a href="https://fallout.fandom.com/wiki/The_White_Wash" target="_blank">THE WHITE WASH</a>', '<a href="https://fallout.fandom.com/wiki/There_Stands_the_Grass" target="_blank">THERE STANDS THE GRASS</a>', '<a href="https://fallout.fandom.com/wiki/Three-Card_Bounty" target="_blank">THREE-CARD BOUNTY</a>', '<a href="https://fallout.fandom.com/wiki/Unfriendly_Persuasion" target="_blank">UNFRIENDLY PERSUASION</a>', '<a href="https://fallout.fandom.com/wiki/Volare!" target="_blank">VOLARE!</a>', '<a href="https://fallout.fandom.com/wiki/Wang_Dang_Atomic_Tango" target="_blank">WANG DANG ATOMIC TANGO</a>', '<a href="https://fallout.fandom.com/wiki/We_Will_All_Go_Together" target="_blank">WE WILL ALL GO TOGETHER</a>', '<a href="https://fallout.fandom.com/wiki/Wheel_of_Fortune" target="_blank">WHEEL OF FORTUNE</a>', '<a href="https://fallout.fandom.com/wiki/Why_Can%27t_We_Be_Friends%3F" target="_blank">WHY CAN\'T WE BE FRIENDS?</a>', '<a href="https://fallout.fandom.com/wiki/You_Can_Depend_on_Me" target="_blank">YOU CAN DEPEND ON ME</a>', '<a href="https://fallout.fandom.com/wiki/Young_Hearts" target="_blank">YOUNG HEARTS</a>'],
        'DLC: DEAD MONEY': ['<a href="https://fallout.fandom.com/wiki/Sierra_Madre_Grand_Opening!" target="_blank">SIERRA MADRE GRAND OPENING!</a>', '<a href="https://fallout.fandom.com/wiki/Find_Collar_8:_Dog" target="_blank">FIND COLLAR 8: DOG</a>', '<a href="https://fallout.fandom.com/wiki/Find_Collar_12:_Christine" target="_blank">FIND COLLAR 12: CHRISTINE</a>', '<a href="https://fallout.fandom.com/wiki/Find_Collar_14:_Dean_Domino" target="_blank">FIND COLLAR 14: DEAN DOMINO</a>', '<a href="https://fallout.fandom.com/wiki/Fires_in_the_Sky" target="_blank">FIRES IN THE SKY</a>', '<a href="https://fallout.fandom.com/wiki/Strike_Up_the_Band" target="_blank">STRIKE UP THE BAND</a>', '<a href="https://fallout.fandom.com/wiki/Trigger_the_Gala_Event" target="_blank">TRIGGER THE GALA EVENT</a>', '<a href="https://fallout.fandom.com/wiki/Curtain_Call_at_the_Tampico" target="_blank">CURTAIN CALL AT THE TAMPICO</a>', '<a href="https://fallout.fandom.com/wiki/Last_Luxuries" target="_blank">LAST LUXURIES</a>', '<a href="https://fallout.fandom.com/wiki/Heist_of_the_Centuries" target="_blank">HEIST OF THE CENTURIES</a>', '<a href="https://fallout.fandom.com/wiki/Departing_Paradise" target="_blank">DEPARTING PARADISE</a>'],
        'DLC: HONEST HEARTS': ['<a href="https://fallout.fandom.com/wiki/Happy_Trails_Expedition" target="_blank">HAPPY TRAILS EXPEDITION</a>', '<a href="https://fallout.fandom.com/wiki/Arrival_at_Zion" target="_blank">ARRIVAL AT ZION</a>', '<a href="https://fallout.fandom.com/wiki/Roadside_Attraction" target="_blank">ROADSIDE ATTRACTION</a>', '<a href="https://fallout.fandom.com/wiki/Gone_Fishin%27" target="_blank">GONE FISHIN\'</a>', '<a href="https://fallout.fandom.com/wiki/Tourist_Trap" target="_blank">TOURIST TRAP</a>', '<a href="https://fallout.fandom.com/wiki/Deliverer_of_Sorrows" target="_blank">DELIVERER OF SORROWS</a>', '<a href="https://fallout.fandom.com/wiki/The_Grand_Staircase" target="_blank">THE GRAND STAIRCASE</a>', '<a href="https://fallout.fandom.com/wiki/The_Advance_Scouts" target="_blank">THE ADVANCE SCOUTS</a>', '<a href="https://fallout.fandom.com/wiki/The_Treacherous_Road" target="_blank">THE TREACHEROUS ROAD</a>', '<a href="https://fallout.fandom.com/wiki/River_Monsters" target="_blank">RIVER MONSTERS</a>', '<a href="https://fallout.fandom.com/wiki/Gathering_Storms" target="_blank">GATHERING STORMS</a>', '<a href="https://fallout.fandom.com/wiki/Crush_the_White_Legs" target="_blank">CRUSH THE WHITE LEGS</a>'],
        'DLC: OLD WORLD BLUES': ['<a href="https://fallout.fandom.com/wiki/Midnight_Science_Fiction_Feature!" target="_blank">MIDNIGHT SCIENCE FICTION FEATURE!</a>', '<a href="https://fallout.fandom.com/wiki/Welcome_to_the_Big_Empty" target="_blank">WELCOME TO THE BIG EMPTY</a>', '<a href="https://fallout.fandom.com/wiki/All_My_Friends_Have_Off_Switches" target="_blank">ALL MY FRIENDS HAVE OFF SWITCHES</a>', '<a href="https://fallout.fandom.com/wiki/X-2:_Strange_Transmissions!" target="_blank">X-2: STRANGE TRANSMISSIONS!</a>', '<a href="https://fallout.fandom.com/wiki/X-8:_High_School_Horror!" target="_blank">X-8: HIGH SCHOOL HORROR!</a>', '<a href="https://fallout.fandom.com/wiki/X-13:_Attack_of_the_Infiltrator!" target="_blank">X-13: ATTACK OF THE INFILTRATOR!</a>', '<a href="https://fallout.fandom.com/wiki/Old_World_Blues_(quest)" target="_blank">OLD WORLD BLUES</a>', '<a href="https://fallout.fandom.com/wiki/Project_X-13" target="_blank">PROJECT X-13</a>'],
        'DLC: LONESOME ROAD': ['<a href="https://fallout.fandom.com/wiki/The_Reunion" target="_blank">THE REUNION</a>', '<a href="https://fallout.fandom.com/wiki/The_Silo" target="_blank">THE SILO</a>', '<a href="https://fallout.fandom.com/wiki/The_Job" target="_blank">THE JOB</a>', '<a href="https://fallout.fandom.com/wiki/The_Launch" target="_blank">THE LAUNCH</a>', '<a href="https://fallout.fandom.com/wiki/The_Divide" target="_blank">THE DIVIDE</a>', '<a href="https://fallout.fandom.com/wiki/The_Tunnelers" target="_blank">THE TUNNELERS</a>', '<a href="https://fallout.fandom.com/wiki/The_Courier" target="_blank">THE COURIER</a>', '<a href="https://fallout.fandom.com/wiki/The_End_(quest)" target="_blank">THE END</a>', '<a href="https://fallout.fandom.com/wiki/The_Apocalypse" target="_blank">THE APOCALYPSE</a>']
    }
};

/* --- DATA: UNIQUES --- */
const uniqueWeaponData = {
    "PISTOLS & REVOLVERS": ["<a href='https://fallout.fandom.com/wiki/A_Light_Shining_in_Darkness' target='_blank'>A LIGHT SHINING IN DARKNESS</a>", "<a href='https://fallout.fandom.com/wiki/Blackhawk' target='_blank'>BLACKHAWK</a>", "<a href='https://fallout.fandom.com/wiki/Callahan%27s_magnum' target='_blank'>CALLAHAN'S MAGNUM</a>", "<a href='https://fallout.fandom.com/wiki/Colonel_Autumn%27s_10mm_pistol' target='_blank'>COLONEL AUTUMN'S 10MM PISTOL</a>", "<a href='https://fallout.fandom.com/wiki/Li%27l_Devil' target='_blank'>LI'L DEVIL</a>", "<a href='https://fallout.fandom.com/wiki/Lucky' target='_blank'>LUCKY</a>", "<a href='https://fallout.fandom.com/wiki/Maria' target='_blank'>MARIA</a>", "<a href='https://fallout.fandom.com/wiki/Mysterious_Magnum' target='_blank'>MYSTERIOUS MAGNUM</a>", "<a href='https://fallout.fandom.com/wiki/Paulson%27s_revolver' target='_blank'>PAULSON'S REVOLVER</a>", "<a href='https://fallout.fandom.com/wiki/Ranger_Sequoia' target='_blank'>RANGER SEQUOIA</a>", "<a href='https://fallout.fandom.com/wiki/That_Gun' target='_blank'>THAT GUN</a>", "<a href='https://fallout.fandom.com/wiki/Weathered_10mm_pistol' target='_blank'>WEATHERED 10MM PISTOL</a>", "<a href='https://fallout.fandom.com/wiki/Wild_Bill%27s_Sidearm' target='_blank'>WILD BILL'S SIDEARM</a>", "<a href='https://fallout.fandom.com/wiki/Zhu-Rong_v418_Chinese_pistol' target='_blank'>ZHU-RONG V418 CHINESE PISTOL</a>"],
    "SMGS & RIFLES": ["<a href='https://fallout.fandom.com/wiki/Abilene_Kid_LE_BB_gun' target='_blank'>ABILENE KID LE BB GUN</a>", "<a href='https://fallout.fandom.com/wiki/All-American' target='_blank'>ALL-AMERICAN</a>", "<a href='https://fallout.fandom.com/wiki/Backwater_rifle' target='_blank'>BACKWATER RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Christine%27s_CoS_silencer_rifle' target='_blank'>CHRISTINE'S COS SILENCER RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Gobi_Campaign_scout_rifle' target='_blank'>GOBI CAMPAIGN SCOUT RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Infiltrator' target='_blank'>INFILTRATOR</a>", "<a href='https://fallout.fandom.com/wiki/La_Longue_Carabine' target='_blank'>LA LONGUE CARABINE</a>", "<a href='https://fallout.fandom.com/wiki/Lincoln%27s_repeater' target='_blank'>LINCOLN'S REPEATER</a>", "<a href='https://fallout.fandom.com/wiki/Medicine_Stick' target='_blank'>MEDICINE STICK</a>", "<a href='https://fallout.fandom.com/wiki/Ol%27_Painless' target='_blank'>OL' PAINLESS</a>", "<a href='https://fallout.fandom.com/wiki/Paciencia' target='_blank'>PACIENCIA</a>", "<a href='https://fallout.fandom.com/wiki/Perforator' target='_blank'>PERFORATOR</a>", "<a href='https://fallout.fandom.com/wiki/Ratslayer' target='_blank'>RATSLAYER</a>", "<a href='https://fallout.fandom.com/wiki/Reservist%27s_rifle' target='_blank'>RESERVIST'S RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Sleepytyme' target='_blank'>SLEEPYTYME</a>", "<a href='https://fallout.fandom.com/wiki/Survivalist%27s_rifle' target='_blank'>SURVIVALIST'S RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Sydney%27s_10mm_%22Ultra%22_SMG' target='_blank'>SYDNEY'S 10MM \"ULTRA\" SMG</a>", "<a href='https://fallout.fandom.com/wiki/This_Machine' target='_blank'>THIS MACHINE</a>", "<a href='https://fallout.fandom.com/wiki/Vance%27s_9mm_SMG' target='_blank'>VANCE'S 9MM SMG</a>", "<a href='https://fallout.fandom.com/wiki/Victory_rifle' target='_blank'>VICTORY RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Wanda_(weapon)' target='_blank'>WANDA</a>", "<a href='https://fallout.fandom.com/wiki/Xuanlong_assault_rifle' target='_blank'>XUANLONG ASSAULT RIFLE</a>"],
    "SHOTGUNS": ["<a href='https://fallout.fandom.com/wiki/Big_Boomer' target='_blank'>BIG BOOMER</a>", "<a href='https://fallout.fandom.com/wiki/Dinner_Bell' target='_blank'>DINNER BELL</a>", "<a href='https://fallout.fandom.com/wiki/Sturdy_caravan_shotgun' target='_blank'>STURDY CARAVAN SHOTGUN</a>", "<a href='https://fallout.fandom.com/wiki/The_Kneecapper' target='_blank'>THE KNEECAPPER</a>", "<a href='https://fallout.fandom.com/wiki/The_Terrible_Shotgun' target='_blank'>THE TERRIBLE SHOTGUN</a>"],
    "BIG GUNS": ["<a href='https://fallout.fandom.com/wiki/Bozar_(Fallout:_New_Vegas)' target='_blank'>BOZAR</a>", "<a href='https://fallout.fandom.com/wiki/Burnmaster' target='_blank'>BURNMASTER</a>", "<a href='https://fallout.fandom.com/wiki/CZ57_Avenger' target='_blank'>CZ57 AVENGER</a>", "<a href='https://fallout.fandom.com/wiki/Drone_cannon_Ex-B' target='_blank'>DRONE CANNON EX-B</a>", "<a href='https://fallout.fandom.com/wiki/Eugene' target='_blank'>EUGENE</a>", "<a href='https://fallout.fandom.com/wiki/Experimental_MIRV' target='_blank'>EXPERIMENTAL MIRV</a>", "<a href='https://fallout.fandom.com/wiki/Precision_Gatling_laser' target='_blank'>PRECISION GATLING LASER</a>", "<a href='https://fallout.fandom.com/wiki/Rapid-torch_flamer' target='_blank'>RAPID-TORCH FLAMER</a>", "<a href='https://fallout.fandom.com/wiki/Slo-burn_flamer' target='_blank'>SLO-BURN FLAMER</a>", "<a href='https://fallout.fandom.com/wiki/Vengeance' target='_blank'>VENGEANCE</a>"],
    "ENERGY WEAPONS": ["<a href='https://fallout.fandom.com/wiki/A3-21%27s_plasma_rifle' target='_blank'>A3-21'S PLASMA RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/AER14_prototype' target='_blank'>AER14 PROTOTYPE</a>", "<a href='https://fallout.fandom.com/wiki/Alien_blaster_(Fallout_3)' target='_blank'>ALIEN BLASTER</a>", "<a href='https://fallout.fandom.com/wiki/Atomic_pulverizer' target='_blank'>ATOMIC PULVERIZER</a>", "<a href='https://fallout.fandom.com/wiki/Captain%27s_sidearm' target='_blank'>CAPTAIN'S SIDEARM</a>", "<a href='https://fallout.fandom.com/wiki/Cleansing_Flame' target='_blank'>CLEANSING FLAME</a>", "<a href='https://fallout.fandom.com/wiki/Colonel_Autumn%27s_laser_pistol' target='_blank'>COLONEL AUTUMN'S LASER PISTOL</a>", "<a href='https://fallout.fandom.com/wiki/Compliance_Regulator' target='_blank'>COMPLIANCE REGULATOR</a>", "<a href='https://fallout.fandom.com/wiki/Destabilizer' target='_blank'>DESTABILIZER</a>", "<a href='https://fallout.fandom.com/wiki/Elijah%27s_advanced_LAER' target='_blank'>ELIJAH'S ADVANCED LAER</a>", "<a href='https://fallout.fandom.com/wiki/Elijah%27s_jury-rigged_Tesla_cannon' target='_blank'>ELIJAH'S JURY-RIGGED TESLA CANNON</a>", "<a href='https://fallout.fandom.com/wiki/Euclid%27s_C-Finder' target='_blank'>EUCLID'S C-FINDER</a>", "<a href='https://fallout.fandom.com/wiki/Firelance' target='_blank'>FIRELANCE</a>", "<a href='https://fallout.fandom.com/wiki/Gauss_rifle_(Fallout_3)' target='_blank'>GAUSS RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Holorifle' target='_blank'>HOLORIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Mesmetron' target='_blank'>MESMETRON</a>", "<a href='https://fallout.fandom.com/wiki/Metal_Blaster' target='_blank'>METAL BLASTER</a>", "<a href='https://fallout.fandom.com/wiki/MF_Hyperbreeder_Alpha' target='_blank'>MF HYPERBREEDER ALPHA</a>", "<a href='https://fallout.fandom.com/wiki/Microwave_emitter' target='_blank'>MICROWAVE EMITTER</a>", "<a href='https://fallout.fandom.com/wiki/Missing_laser_pistol' target='_blank'>MISSING LASER PISTOL</a>", "<a href='https://fallout.fandom.com/wiki/MPLX_Novasurge' target='_blank'>MPLX NOVASURGE</a>", "<a href='https://fallout.fandom.com/wiki/Pew_Pew' target='_blank'>PEW PEW</a>", "<a href='https://fallout.fandom.com/wiki/Protectron%27s_Gaze' target='_blank'>PROTECTRON'S GAZE</a>", "<a href='https://fallout.fandom.com/wiki/Pulse_gun' target='_blank'>PULSE GUN</a>", "<a href='https://fallout.fandom.com/wiki/Q-35_matter_modulator' target='_blank'>Q-35 MATTER MODULATOR</a>", "<a href='https://fallout.fandom.com/wiki/Smuggler%27s_End' target='_blank'>SMUGGLER'S END</a>", "<a href='https://fallout.fandom.com/wiki/Sprtel-Wood_9700' target='_blank'>SPRTEL-WOOD 9700</a>", "<a href='https://fallout.fandom.com/wiki/Tesla-Beaton_prototype' target='_blank'>TESLA-BEATON PROTOTYPE</a>", "<a href='https://fallout.fandom.com/wiki/The_Smitty_Special' target='_blank'>THE SMITTY SPECIAL</a>", "<a href='https://fallout.fandom.com/wiki/Wazer_Wifle' target='_blank'>WAZER WIFLE</a>", "<a href='https://fallout.fandom.com/wiki/YCS/186' target='_blank'>YCS/186</a>"],
    "EXPLOSIVES": ["<a href='https://fallout.fandom.com/wiki/Annabelle' target='_blank'>ANNABELLE</a>", "<a href='https://fallout.fandom.com/wiki/Esther' target='_blank'>ESTHER</a>", "<a href='https://fallout.fandom.com/wiki/Great_Bear_grenade_rifle' target='_blank'>GREAT BEAR GRENADE RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Holy_Frag_Grenade' target='_blank'>HOLY FRAG GRENADE</a>", "<a href='https://fallout.fandom.com/wiki/Mercenary%27s_grenade_rifle' target='_blank'>MERCENARY'S GRENADE RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Mercy' target='_blank'>MERCY</a>", "<a href='https://fallout.fandom.com/wiki/Miss_Launcher' target='_blank'>MISS LAUNCHER</a>", "<a href='https://fallout.fandom.com/wiki/Red_Victory_grenade_rifle' target='_blank'>RED VICTORY GRENADE RIFLE</a>", "<a href='https://fallout.fandom.com/wiki/Thump-Thump' target='_blank'>THUMP-THUMP</a>"],
    "MELEE WEAPONS": ["<a href='https://fallout.fandom.com/wiki/Ant%27s_Sting' target='_blank'>ANT'S STING</a>", "<a href='https://fallout.fandom.com/wiki/Blade_of_the_East' target='_blank'>BLADE OF THE EAST</a>", "<a href='https://fallout.fandom.com/wiki/Blood-Nap' target='_blank'>BLOOD-NAP</a>", "<a href='https://fallout.fandom.com/wiki/Board_of_Education' target='_blank'>BOARD OF EDUCATION</a>", "<a href='https://fallout.fandom.com/wiki/Broad_machete' target='_blank'>BROAD MACHETE</a>", "<a href='https://fallout.fandom.com/wiki/Butch%27s_Toothpick' target='_blank'>BUTCH'S TOOTHPICK</a>", "<a href='https://fallout.fandom.com/wiki/Chance%27s_knife' target='_blank'>CHANCE'S KNIFE</a>", "<a href='https://fallout.fandom.com/wiki/Chopper' target='_blank'>CHOPPER</a>", "<a href='https://fallout.fandom.com/wiki/Electro-Suppressor' target='_blank'>ELECTRO-SUPPRESSOR</a>", "<a href='https://fallout.fandom.com/wiki/Fawkes%27_super_sledge' target='_blank'>FAWKES' SUPER SLEDGE</a>", "<a href='https://fallout.fandom.com/wiki/Fertilizer_shovel' target='_blank'>FERTILIZER SHOVEL</a>", "<a href='https://fallout.fandom.com/wiki/Figaro' target='_blank'>FIGARO</a>", "<a href='https://fallout.fandom.com/wiki/Gehenna' target='_blank'>GEHENNA</a>", "<a href='https://fallout.fandom.com/wiki/Highwayman%27s_Friend' target='_blank'>HIGHWAYMAN'S FRIEND</a>", "<a href='https://fallout.fandom.com/wiki/Jack_(Fallout_3)' target='_blank'>JACK</a>", "<a href='https://fallout.fandom.com/wiki/Jingwei%27s_shock_sword' target='_blank'>JINGWEI'S SHOCKSWORD</a>", "<a href='https://fallout.fandom.com/wiki/Knock-Knock' target='_blank'>KNOCK-KNOCK</a>", "<a href='https://fallout.fandom.com/wiki/Liberator' target='_blank'>LIBERATOR</a>", "<a href='https://fallout.fandom.com/wiki/Man_Opener' target='_blank'>MAN OPENER</a>", "<a href='https://fallout.fandom.com/wiki/Nephi%27s_golf_driver' target='_blank'>NEPHI'S GOLF DRIVER</a>", "<a href='https://fallout.fandom.com/wiki/Nuka-Breaker' target='_blank'>NUKA-BREAKER</a>", "<a href='https://fallout.fandom.com/wiki/Occam%27s_Razor' target='_blank'>OCCAM'S RAZOR</a>", "<a href='https://fallout.fandom.com/wiki/Oh,_Baby!' target='_blank'>OH, BABY!</a>", "<a href='https://fallout.fandom.com/wiki/Old_Glory' target='_blank'>OLD GLORY</a>", "<a href='https://fallout.fandom.com/wiki/Repellent_stick' target='_blank'>REPELLENT STICK</a>", "<a href='https://fallout.fandom.com/wiki/Ritual_knife' target='_blank'>RITUAL KNIFE</a>", "<a href='https://fallout.fandom.com/wiki/Samurai%27s_sword' target='_blank'>SAMURAI'S SWORD</a>", "<a href='https://fallout.fandom.com/wiki/Stabhappy' target='_blank'>STABHAPPY</a>", "<a href='https://fallout.fandom.com/wiki/The_Break' target='_blank'>THE BREAK</a>", "<a href='https://fallout.fandom.com/wiki/The_Dismemberer' target='_blank'>THE DISMEMBERER</a>", "<a href='https://fallout.fandom.com/wiki/The_Humble_Cudgel' target='_blank'>THE HUMBLE CUDGEL</a>", "<a href='https://fallout.fandom.com/wiki/The_Mauler' target='_blank'>THE MAULER</a>", "<a href='https://fallout.fandom.com/wiki/The_Tenderizer' target='_blank'>THE TENDERIZER</a>", "<a href='https://fallout.fandom.com/wiki/Toy_knife' target='_blank'>TOY KNIFE</a>", "<a href='https://fallout.fandom.com/wiki/Trench_knife' target='_blank'>TRENCH KNIFE</a>", "<a href='https://fallout.fandom.com/wiki/Vampire%27s_Edge' target='_blank'>VAMPIRE'S EDGE</a>", "<a href='https://fallout.fandom.com/wiki/X-2_antenna' target='_blank'>X-2 ANTENNA</a>"],
    "UNARMED": ["<a href='https://fallout.fandom.com/wiki/Cram_Opener' target='_blank'>CRAM OPENER</a>", "<a href='https://fallout.fandom.com/wiki/Dr._Klein%27s_glove' target='_blank'>DR. KLEIN'S GLOVE</a>", "<a href='https://fallout.fandom.com/wiki/Dr._Mobius%27_glove' target='_blank'>DR. MOBIUS' GLOVE</a>", "<a href='https://fallout.fandom.com/wiki/Embrace_of_the_Mantis_King!' target='_blank'>EMBRACE OF THE MANTIS KING!</a>", "<a href='https://fallout.fandom.com/wiki/Fist_of_Rawr' target='_blank'>FIST OF RAWR</a>", "<a href='https://fallout.fandom.com/wiki/Fisto!' target='_blank'>FISTO!</a>", "<a href='https://fallout.fandom.com/wiki/Golden_Gloves' target='_blank'>GOLDEN GLOVES</a>", "<a href='https://fallout.fandom.com/wiki/Greased_Lightning_(Gun_Runners%27_Arsenal)' target='_blank'>GREASED LIGHTNING</a>", "<a href='https://fallout.fandom.com/wiki/Love_and_Hate' target='_blank'>LOVE AND HATE</a>", "<a href='https://fallout.fandom.com/wiki/Paladin_Toaster' target='_blank'>PALADIN TOASTER</a>", "<a href='https://fallout.fandom.com/wiki/Plunkett%27s_Valid_Points' target='_blank'>PLUNKETT'S VALID POINTS</a>", "<a href='https://fallout.fandom.com/wiki/Pushy' target='_blank'>PUSHY</a>", "<a href='https://fallout.fandom.com/wiki/Recompense_of_the_Fallen' target='_blank'>RECOMPENSE OF THE FALLEN</a>", "<a href='https://fallout.fandom.com/wiki/Salt-Upon-Wounds%27_power_fist' target='_blank'>SALT-UPON-WOUNDS' POWER FIST</a>", "<a href='https://fallout.fandom.com/wiki/She%27s_Embrace' target='_blank'>SHE'S EMBRACE</a>", "<a href='https://fallout.fandom.com/wiki/The_Shocker' target='_blank'>THE SHOCKER</a>", "<a href='https://fallout.fandom.com/wiki/Two-Step_Goodbye' target='_blank'>TWO-STEP GOODBYE</a>"]
};

/* ===== XSS SANITIZATION ===== */
function sanitizeStr(s) {
    if (typeof s !== 'string') return '';
    return s
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/javascript\s*:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<[^>]+>/g, '')
        .substring(0, 3000);
}

function sanitizeImport(d) {
    if (!d || typeof d !== 'object') return null;
    const clean = {};
    clean.name = sanitizeStr(d.name || '');
    clean.notes = sanitizeStr(d.notes || '');
    clean.mode = ['std', 'hc'].includes(d.mode) ? d.mode : 'std';
    clean.origin = ['CW', 'MW'].includes(d.origin) ? d.origin : 'CW';
    clean.special = {};
    sKeys.forEach(k => {
        const v = parseInt(d.special?.[k]);
        clean.special[k] = (!isNaN(v) && v >= 1 && v <= 10) ? v : 5;
    });
    ['tags', 'quests', 'colls', 'uniWpns', 'uniArmor'].forEach(key => {
        clean[key] = Array.isArray(d[key]) ? d[key].map(v => !!v) : [];
    });
    clean.traits = Array.isArray(d.traits) ? d.traits.map(v => sanitizeStr(v || '')).slice(0, 10) : [];
    clean.perks = Array.isArray(d.perks) ? d.perks.map(arr =>
        Array.isArray(arr) ? arr.map(v => sanitizeStr(v || '')) : ['', '']
    ) : [];
    clean.extraPerks = Array.isArray(d.extraPerks) ? d.extraPerks.map(arr =>
        Array.isArray(arr) ? arr.map(v => sanitizeStr(v || '')) : ['', '']
    ).slice(0, 50) : [];
    clean.weapons = Array.isArray(d.weapons) ? d.weapons.map(arr =>
        Array.isArray(arr) ? arr.map(v => sanitizeStr(v || '')) : ['', '', '']
    ).slice(0, 20) : [];
    clean.armor = Array.isArray(d.armor) ? d.armor.map(arr => {
        const slot = ['LIGHT', 'MEDIUM', 'HEAVY', 'POWER ARMOR'].includes(arr?.[2]) ? arr[2] : 'LIGHT';
        return [sanitizeStr(arr?.[0] || ''), sanitizeStr(arr?.[1] || ''), slot];
    }).slice(0, 20) : [];
    if (d.regionalStorage && typeof d.regionalStorage === 'object') {
        clean.regionalStorage = {
            'CW': {
                quests: Array.isArray(d.regionalStorage['CW']?.quests) ? d.regionalStorage['CW'].quests.map(v => !!v) : [],
                colls: Array.isArray(d.regionalStorage['CW']?.colls) ? d.regionalStorage['CW'].colls.map(v => !!v) : []
            },
            'MW': {
                quests: Array.isArray(d.regionalStorage['MW']?.quests) ? d.regionalStorage['MW'].quests.map(v => !!v) : [],
                colls: Array.isArray(d.regionalStorage['MW']?.colls) ? d.regionalStorage['MW'].colls.map(v => !!v) : []
            }
        };
    } else {
        clean.regionalStorage = { 'CW': { quests: [], colls: [] }, 'MW': { quests: [], colls: [] } };
    }
    return clean;
}

/* ===== TAB CONTROLLER ===== */
function showTab(t) {
    document.querySelectorAll('.tab-content').forEach(c => c.style.display='none');
    document.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-'+t).style.display='block';
    document.getElementById('tab-btn-'+t).classList.add('active');
    if (t === 'perks') renderAllPerks();
}

/* ===== MODE & ORIGIN TOGGLES ===== */
function setMode(m, skipSave=false) {
    // Save current perk entries before wiping the list
    const prevPerks = Array.from(document.querySelectorAll('#prog-list .prog-row')).map(r => [
        r.querySelector('.prog-name-input')?.value || '',
        r.querySelector('.prog-notes-input')?.value || ''
    ]);
    mode = m; document.body.classList.toggle('mode-hc', m==='hc');
    document.getElementById('hc-banner').style.display = m==='hc' ? 'flex' : 'none';
    document.getElementById('sysop-note').style.display = m==='hc' ? 'block' : 'none';
    document.getElementById('m-std').classList.toggle('active', m==='std');
    document.getElementById('m-hc').classList.toggle('active', m==='hc');
    renderProgression();
    // Restore as many perks as will fit in the new layout
    if (!skipSave && prevPerks.some(p => p[0])) {
        const newRows = document.querySelectorAll('#prog-list .prog-row');
        prevPerks.forEach((v, i) => {
            if (newRows[i] && v[0]) {
                tryHydratePerkRow(newRows[i], v[0]);
                const ni = newRows[i].querySelector('.prog-notes-input'); if(ni) ni.value = v[1] || '';
            }
        });
    }
    updateAll();
    if(!skipSave) triggerAutosave();
}

function setOrigin(o, skipSave=false) {
    if (!skipSave) {
        regionalStorage[origin].quests = Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked);
        regionalStorage[origin].colls = Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked);
    }
    origin = o;
    document.body.className = (o === 'MW') ? 'theme-mw' : 'theme-cw';
    if(mode==='hc') document.body.classList.add('mode-hc');
    document.getElementById('btn-cw').classList.toggle('active', o==='CW');
    document.getElementById('btn-mw').classList.toggle('active', o==='MW');
    renderQuests();
    renderCollectibles();
    const qC = document.querySelectorAll('#quest-list-container input');
    regionalStorage[origin].quests.forEach((c, i) => { if(qC[i]) qC[i].checked = c; });
    const cC = document.querySelectorAll('#coll-list input');
    regionalStorage[origin].colls.forEach((c, i) => { if(cC[i]) cC[i].checked = c; });
    document.querySelectorAll('.header-row').forEach(h => {
        const id = h.id.replace('h-', '');
        calcCat(id);
    });
    updateAll();
    if(!skipSave) triggerAutosave();
}

/* ===== COLLAPSE LOGIC ===== */
function toggleCollapse(id) {
    const grid = document.querySelector(`.grid-tidy[data-category="${id}"]`);
    if (grid) grid.style.display = (grid.style.display === 'none') ? 'grid' : 'none';
}

/* ===== SEARCH LOGIC ===== */
function searchItems(inputId, containerId) {
    const query = document.getElementById(inputId).value.toUpperCase();
    const items = document.querySelectorAll(`#${containerId} .grid-item`);
    items.forEach(item => {
        item.style.display = item.innerText.toUpperCase().includes(query) ? 'flex' : 'none';
    });
    document.querySelectorAll(`#${containerId} .grid-tidy`).forEach(grid => {
        const visibleCount = Array.from(grid.querySelectorAll('.grid-item')).filter(i => i.style.display !== 'none').length;
        const categoryId = grid.getAttribute('data-category');
        const header = document.getElementById(`h-${categoryId}`);
        if (query !== "" && visibleCount > 0) { grid.style.display = 'grid'; header.style.display = 'flex'; }
        else if (query !== "" && visibleCount === 0) { grid.style.display = 'none'; header.style.display = 'none'; }
        else { header.style.display = 'flex'; }
    });
}

function searchQuests() { searchItems('quest-search-bar', 'quest-list-container'); }
function searchUniques() { searchItems('uni-search-bar', 'unique-weapon-checklist'); }

/* ===== ALL PERKS TAB: SORT & RENDER ===== */
function getPerkLevel(perk) {
    const m = perk.req.match(/Level\s+(\d+)/i);
    return m ? parseInt(m[1]) : 0;
}

function getPerkSPECIAL(perk) {
    const order = ['STR','PER','END','CHA','INT','AGI','LCK'];
    const m = perk.req.match(/\b(STR|PER|END|CHA|INT|AGI|LCK)\b/);
    if (!m) return 99;
    return order.indexOf(m[1]);
}

function setSort(s) {
    currentSort = s;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('sort-'+s).classList.add('active');
    renderAllPerks();
}

function renderAllPerks() {
    const query = (document.getElementById('perk-search-bar')?.value || '').toUpperCase().trim();
    let perks = PERKS_DATA.filter(p =>
        !query || p.name.toUpperCase().includes(query) || p.req.toUpperCase().includes(query) || p.desc.toUpperCase().includes(query)
    );

    if (currentSort === 'az') {
        perks = [...perks].sort((a, b) => a.name.localeCompare(b.name));
    } else if (currentSort === 'lvl') {
        perks = [...perks].sort((a, b) => getPerkLevel(a) - getPerkLevel(b) || a.name.localeCompare(b.name));
    } else if (currentSort === 'spec') {
        perks = [...perks].sort((a, b) => getPerkSPECIAL(a) - getPerkSPECIAL(b) || a.name.localeCompare(b.name));
    }

    const container = document.getElementById('all-perks-list');
    container.innerHTML = '';
    if (perks.length === 0) {
        container.innerHTML = '<div style="opacity:0.5; padding:20px; text-align:center;">NO PERKS MATCH QUERY</div>';
        return;
    }

    const SPECIAL_LABELS = ['STR','PER','END','CHA','INT','AGI','LCK','—'];
    // Group by SPECIAL if sort is spec
    if (currentSort === 'spec') {
        const groups = {};
        const specNames = ['STR — STRENGTH','PER — PERCEPTION','END — ENDURANCE','CHA — CHARISMA','INT — INTELLIGENCE','AGI — AGILITY','LCK — LUCK','NO SPECIAL REQ.'];
        perks.forEach(p => {
            const idx = getPerkSPECIAL(p);
            const key = idx >= 7 ? 7 : idx;
            if (!groups[key]) groups[key] = [];
            groups[key].push(p);
        });
        Object.keys(groups).sort((a,b)=>a-b).forEach(k => {
            const label = specNames[parseInt(k)] || 'OTHER';
            container.insertAdjacentHTML('beforeend', `<div style="background:var(--pip-color);color:black;font-weight:bold;padding:4px 8px;font-size:0.75rem;margin-bottom:5px;margin-top:10px;">${label}</div>`);
            groups[k].forEach(p => container.insertAdjacentHTML('beforeend', buildPerkCard(p)));
        });
    } else {
        perks.forEach(p => container.insertAdjacentHTML('beforeend', buildPerkCard(p)));
    }
}

function buildPerkCard(p) {
    const isIT = p.name.trim().toUpperCase() === 'INTENSE TRAINING';
    const multiRank = p.ranks > 1;
    const rankBadgeClass = multiRank ? 'perk-rank-badge multi' : 'perk-rank-badge';
    const rankLabel = multiRank ? `★ ${p.ranks} RANKS` : `1 RANK`;
    const addBtnLabel = isIT ? '+ ADD TO BUILD (PICK SPECIAL)' : '+ ADD TO BUILD';
    const escapedName = p.name.replace(/'/g, "\\'");
    const escapedReq = p.req.replace(/'/g, "\\'");

    return `<div class="perk-card">
        <div class="perk-card-header">
            <h3>${p.name}</h3>
            <span class="${rankBadgeClass}">${rankLabel}</span>
        </div>
        <div class="perk-req">REQ: ${p.req}</div>
        <div class="perk-desc">${p.desc}</div>
        <div class="perk-card-actions">
            <button class="action-btn" onclick="addPerkToBuild('${escapedName}','${escapedReq}',${isIT})">${addBtnLabel}</button>
        </div>
    </div>`;
}

function addPerkToBuild(name, req, isIT) {
    if (isIT) { openITModal(name, req); return; }
    const rows = document.querySelectorAll('#prog-list .prog-row');
    for (const row of rows) {
        const nameInput = row.querySelector('.prog-name-input');
        if (!nameInput.value.trim()) {
            selectPerkInRow(row, name);
            showTab('prog');
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nameInput.focus();
            return;
        }
    }
    addExtraPerk();
    const extras = document.querySelectorAll('#extra-perk-list .prog-row');
    const last = extras[extras.length - 1];
    if (last) selectPerkInRow(last, name);
    showTab('prog');
}

/* ===== INTENSE TRAINING MODAL ===== */
function openITModal(name, req) {
    const grid = document.getElementById('it-picker-grid');
    grid.innerHTML = '';
    sKeys.forEach(k => {
        const val = special[k];
        const isMaxed = val >= 10;
        const cls = isMaxed ? 'special-pick-btn maxed' : 'special-pick-btn';
        const title = isMaxed ? `${k} IS ALREADY AT MAX (10)` : `ADD +1 TO ${k}`;
        grid.insertAdjacentHTML('beforeend',
            `<button class="${cls}" title="${title}" onclick="confirmIT('${name}','${req}','${k}')">
                <span>${k}</span>
                <span class="spk-val">${val}</span>
                <span style="font-size:0.6rem;">${isMaxed ? 'MAX' : '+1'}</span>
            </button>`
        );
    });
    document.getElementById('it-modal').classList.add('active');
}

function closeITModal() {
    document.getElementById('it-modal').classList.remove('active');
}

function confirmIT(name, req, statKey) {
    if (special[statKey] < 10) special[statKey] += 1;
    closeITModal();
    const label = `${name} (+1 ${statKey})`;
    const rows = document.querySelectorAll('#prog-list .prog-row');
    for (const row of rows) {
        const nameInput = row.querySelector('.prog-name-input');
        if (!nameInput.value.trim()) {
            selectPerkInRow(row, name);
            nameInput.value = label;
            const ni = row.querySelector('.prog-notes-input'); if(ni) ni.value = req;
            showTab('prog');
            nameInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            triggerAutosave();
            return;
        }
    }
    addExtraPerk();
    const extras = document.querySelectorAll('#extra-perk-list .prog-row');
    const last = extras[extras.length - 1];
    if (last) {
        selectPerkInRow(last, name);
        last.querySelector('.prog-name-input').value = label;
        const ni = last.querySelector('.prog-notes-input'); if(ni) ni.value = req;
    }
    showTab('prog');
    triggerAutosave();
}

/* Close modal on overlay click */
document.addEventListener('click', function(e) {
    const modal = document.getElementById('it-modal');
    if (e.target === modal) closeITModal();
});

/* ===== RENDER: QUESTS ===== */
function renderQuests() {
    const div = document.getElementById('quest-list-container'); div.innerHTML = '';
    for (const cat in questsData[origin]) {
        const safe = cat.replace(/[&\s]+/g, '-').toLowerCase().replace(/:/g, '');
        let h = `<div class="header-row" id="h-${safe}" onclick="toggleCollapse('${safe}')"><h2>${cat}</h2><span class="cat-pct" id="pct-${safe}">0%</span></div><div class="grid-tidy" data-category="${safe}">`;
        questsData[origin][cat].forEach(q => {
            h += `<div class="grid-item"><input type="checkbox" onchange="calcCat('${safe}'); triggerAutosave();"><span>${q}</span></div>`;
        });
        div.insertAdjacentHTML('beforeend', h + `</div>`);
    }
}

/* ===== RENDER: UNIQUES ===== */
const uniqueArmorData = {
    "POWER ARMOR (FO3)": [
        `<a href="https://fallout.fandom.com/wiki/Ashur%27s_power_armor" target="_blank">Ashur's Power Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Linden%27s_Outcast_power_armor" target="_blank">Linden's Outcast Power Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Prototype_medic_power_armor" target="_blank">Prototype Medic Power Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/T-51b_power_armor_(Fallout_3)" target="_blank">T-51b Power Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Tribal_power_armor" target="_blank">Tribal Power Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Winterized_T-51b_power_armor" target="_blank">Winterized T-51b Power Armor</a>`,
    ],
    "COMBAT ARMOR (FO3)": [
        `<a href="https://fallout.fandom.com/wiki/Armored_Vault_101_jumpsuit" target="_blank">Armored Vault 101 Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Bombshell_armor" target="_blank">Bombshell Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Chinese_stealth_armor_(Fallout_3)" target="_blank">Chinese Stealth Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Composite_recon_armor" target="_blank">Composite Recon Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Grifter%27s_fit" target="_blank">Grifter's Fit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Lag-Bolt%27s_combat_armor" target="_blank">Lag-Bolt's Combat Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Leather_Rebel" target="_blank">Leather Rebel</a>`,
        `<a href="https://fallout.fandom.com/wiki/Metal_Master_armor" target="_blank">Metal Master Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Ranger_battle_armor" target="_blank">Ranger Battle Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/The_AntAgonizer%27s_costume" target="_blank">The AntAgonizer's Costume</a>`,
        `<a href="https://fallout.fandom.com/wiki/Wanderer%27s_leather_armor" target="_blank">Wanderer's Leather Armor</a>`,
    ],
    "OUTFITS & CLOTHING (FO3)": [
        `<a href="https://fallout.fandom.com/wiki/All-Nighter_nightwear" target="_blank">All-Nighter Nightwear</a>`,
        `<a href="https://fallout.fandom.com/wiki/All-purpose_science_suit_(Fallout_3)" target="_blank">All-Purpose Science Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Colonel_Autumn%27s_uniform" target="_blank">Colonel Autumn's Uniform</a>`,
        `<a href="https://fallout.fandom.com/wiki/Dad%27s_wasteland_outfit" target="_blank">Dad's Wasteland Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Doctor_Li%27s_outfit" target="_blank">Doctor Li's Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Elder_Lyons%27_robe" target="_blank">Elder Lyons' Robe</a>`,
        `<a href="https://fallout.fandom.com/wiki/Environment_suit" target="_blank">Environment Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Eulogy_Jones%27_suit_(Fallout_3)" target="_blank">Eulogy Jones' Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/General_Chase%27s_overcoat" target="_blank">General Chase's Overcoat</a>`,
        `<a href="https://fallout.fandom.com/wiki/General_Jingwei%27s_uniform" target="_blank">General Jingwei's Uniform</a>`,
        `<a href="https://fallout.fandom.com/wiki/Laborer_outfit" target="_blank">Laborer Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Lesko%27s_lab_coat" target="_blank">Lesko's Lab Coat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Maple%27s_garb" target="_blank">Maple's Garb</a>`,
        `<a href="https://fallout.fandom.com/wiki/Mayor_MacCready%27s_outfit" target="_blank">Mayor MacCready's Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Modified_utility_jumpsuit" target="_blank">Modified Utility Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Mysterious_Stranger_outfit" target="_blank">Mysterious Stranger Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Naughty_nightwear_(Fallout_3)" target="_blank">Naughty Nightwear</a>`,
        `<a href="https://fallout.fandom.com/wiki/Neural_interface_suit" target="_blank">Neural Interface Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Paulson%27s_outfit" target="_blank">Paulson's Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Red%27s_jumpsuit" target="_blank">Red's Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Regulator_duster_(Fallout_3)" target="_blank">Regulator Duster</a>`,
        `<a href="https://fallout.fandom.com/wiki/Tenpenny%27s_suit" target="_blank">Tenpenny's Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/The_Surgeon%27s_lab_coat" target="_blank">The Surgeon's Lab Coat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Vance%27s_longcoat_outfit" target="_blank">Vance's Longcoat Outfit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Vault_77_jumpsuit" target="_blank">Vault 77 Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Vault_lab_uniform_(Fallout_3)" target="_blank">Vault Lab Uniform</a>`,
    ],
    "HEADGEAR (FO3)": [
        `<a href="https://fallout.fandom.com/wiki/Boogeyman%27s_hood" target="_blank">Boogeyman's Hood</a>`,
        `<a href="https://fallout.fandom.com/wiki/Button%27s_wig" target="_blank">Button's Wig</a>`,
        `<a href="https://fallout.fandom.com/wiki/Chinese_general_hat" target="_blank">Chinese General Hat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Crow%27s_eyebot_helmet" target="_blank">Crow's Eyebot Helmet</a>`,
        `<a href="https://fallout.fandom.com/wiki/Cryptochromatic_spectacles" target="_blank">Cryptochromatic Spectacles</a>`,
        `<a href="https://fallout.fandom.com/wiki/Desmond%27s_eyeglasses" target="_blank">Desmond's Eyeglasses</a>`,
        `<a href="https://fallout.fandom.com/wiki/Eulogy_Jones%27_hat_(Fallout_3)" target="_blank">Eulogy Jones' Hat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Filtration_helmet" target="_blank">Filtration Helmet</a>`,
        `<a href="https://fallout.fandom.com/wiki/Ghoul_mask" target="_blank">Ghoul Mask</a>`,
        `<a href="https://fallout.fandom.com/wiki/Hat_of_the_People" target="_blank">Hat of the People</a>`,
        `<a href="https://fallout.fandom.com/wiki/Lag-Bolt%27s_shades" target="_blank">Lag-Bolt's Shades</a>`,
        `<a href="https://fallout.fandom.com/wiki/Ledoux%27s_hockey_mask" target="_blank">Ledoux's Hockey Mask</a>`,
        `<a href="https://fallout.fandom.com/wiki/Lincoln%27s_hat" target="_blank">Lincoln's Hat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Lucky_shades_(Fallout_3)" target="_blank">Lucky Shades</a>`,
        `<a href="https://fallout.fandom.com/wiki/MacCready%27s_helmet" target="_blank">MacCready's Helmet</a>`,
        `<a href="https://fallout.fandom.com/wiki/Pint-Sized_Slasher_mask" target="_blank">Pint-Sized Slasher Mask</a>`,
        `<a href="https://fallout.fandom.com/wiki/Poplar%27s_hood" target="_blank">Poplar's Hood</a>`,
    ],
    "POWER ARMOR (FNV)": [
        `<a href="https://fallout.fandom.com/wiki/Gannon_family_Tesla_armor" target="_blank">Gannon Family Tesla Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Remnants_power_armor" target="_blank">Remnants Power Armor</a>`,
    ],
    "COMBAT ARMOR (FNV)": [
        `<a href="https://fallout.fandom.com/wiki/1st_Recon_assault_armor" target="_blank">1st Recon Assault Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/1st_Recon_survival_armor" target="_blank">1st Recon Survival Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Armored_Vault_13_jumpsuit" target="_blank">Armored Vault 13 Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Armored_Vault_21_jumpsuit" target="_blank">Armored Vault 21 Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Assassin_suit" target="_blank">Assassin Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Chinese_stealth_armor_(Fallout:_New_Vegas)" target="_blank">Chinese Stealth Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Explorer%27s_gear" target="_blank">Explorer's Gear</a>`,
        `<a href="https://fallout.fandom.com/wiki/Great_Khan_armored_leather" target="_blank">Great Khan Armored Leather</a>`,
        `<a href="https://fallout.fandom.com/wiki/NCR_Ranger_combat_armor" target="_blank">NCR Ranger Combat Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Space_suit_(Fallout:_New_Vegas)" target="_blank">Space Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Veronica%27s_armored_robes" target="_blank">Veronica's Armored Robes</a>`,
    ],
    "OUTFITS & CLOTHING (FNV)": [
        `<a href="https://fallout.fandom.com/wiki/All-purpose_science_suit_(Fallout:_New_Vegas)" target="_blank">All-Purpose Science Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Ambassador_Crocker%27s_suit" target="_blank">Ambassador Crocker's Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Arcade%27s_lab_coat" target="_blank">Arcade's Lab Coat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Benny%27s_suit" target="_blank">Benny's Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Bounty_hunter_duster" target="_blank">Bounty Hunter Duster</a>`,
        `<a href="https://fallout.fandom.com/wiki/Caesar%27s_armor" target="_blank">Caesar's Armor</a>`,
        `<a href="https://fallout.fandom.com/wiki/Follower%27s_lab_coat" target="_blank">Follower's Lab Coat</a>`,
        `<a href="https://fallout.fandom.com/wiki/General_Oliver%27s_uniform" target="_blank">General Oliver's Uniform</a>`,
        `<a href="https://fallout.fandom.com/wiki/Naughty_nightwear_(Fallout:_New_Vegas)" target="_blank">Naughty Nightwear</a>`,
        `<a href="https://fallout.fandom.com/wiki/Pimp-Boy_3_Billion" target="_blank">Pimp-Boy 3 Billion</a>`,
        `<a href="https://fallout.fandom.com/wiki/President_Kimball%27s_suit" target="_blank">President Kimball's Suit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Rebreather" target="_blank">Rebreather</a>`,
        `<a href="https://fallout.fandom.com/wiki/Regulator_duster_(Fallout:_New_Vegas)" target="_blank">Regulator Duster</a>`,
        `<a href="https://fallout.fandom.com/wiki/RobCo_jumpsuit" target="_blank">RobCo Jumpsuit</a>`,
        `<a href="https://fallout.fandom.com/wiki/Sheriff%27s_duster" target="_blank">Sheriff's Duster</a>`,
        `<a href="https://fallout.fandom.com/wiki/Sleepwear_(Fallout:_New_Vegas)" target="_blank">Sleepwear</a>`,
        `<a href="https://fallout.fandom.com/wiki/Vault_lab_uniform_(Fallout:_New_Vegas)" target="_blank">Vault Lab Uniform</a>`,
        `<a href="https://fallout.fandom.com/wiki/Viva_Las_Vegas" target="_blank">Viva Las Vegas</a>`,
    ],
    "HEADGEAR (FNV)": [
        `<a href="https://fallout.fandom.com/wiki/1st_Recon_beret" target="_blank">1st Recon Beret</a>`,
        `<a href="https://fallout.fandom.com/wiki/Boone%27s_beret" target="_blank">Boone's Beret</a>`,
        `<a href="https://fallout.fandom.com/wiki/Caleb_McCaffery%27s_hat" target="_blank">Caleb McCaffery's Hat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Jessup%27s_bandana" target="_blank">Jessup's Bandana</a>`,
        `<a href="https://fallout.fandom.com/wiki/Lucky_shades_(Fallout:_New_Vegas)" target="_blank">Lucky Shades</a>`,
        `<a href="https://fallout.fandom.com/wiki/Motor-Runner%27s_helmet" target="_blank">Motor-Runner's Helmet</a>`,
        `<a href="https://fallout.fandom.com/wiki/Suave_gambler_hat" target="_blank">Suave Gambler Hat</a>`,
        `<a href="https://fallout.fandom.com/wiki/Tuxedo_hat" target="_blank">Tuxedo Hat</a>`,
    ],
    "DLC ARMOR (FNV)": [
        `<a href="https://fallout.fandom.com/wiki/Advanced_riot_gear" target="_blank">Advanced Riot Gear</a> <span style="opacity:0.5;font-size:0.65rem;">[LR]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Armor_of_the_87th_Tribe" target="_blank">Armor of the 87th Tribe</a> <span style="opacity:0.5;font-size:0.65rem;">[OWB]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Desert_Ranger_combat_armor" target="_blank">Desert Ranger Combat Armor</a> <span style="opacity:0.5;font-size:0.65rem;">[HH]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Dr._Klein%27s_glasses" target="_blank">Dr. Klein's Glasses</a> <span style="opacity:0.5;font-size:0.65rem;">[OWB]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Dr._Klein%27s_scrubs" target="_blank">Dr. Klein's Scrubs</a> <span style="opacity:0.5;font-size:0.65rem;">[OWB]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Dr._Mobius%27_glasses" target="_blank">Dr. Mobius' Glasses</a> <span style="opacity:0.5;font-size:0.65rem;">[OWB]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Dr._Mobius%27_scrubs" target="_blank">Dr. Mobius' Scrubs</a> <span style="opacity:0.5;font-size:0.65rem;">[OWB]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Elite_riot_gear" target="_blank">Elite Riot Gear</a> <span style="opacity:0.5;font-size:0.65rem;">[LR]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Joshua_Graham%27s_armor" target="_blank">Joshua Graham's Armor</a> <span style="opacity:0.5;font-size:0.65rem;">[HH]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Riot_gear_(Lonesome_Road)" target="_blank">Riot Gear</a> <span style="opacity:0.5;font-size:0.65rem;">[LR]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Salt-Upon-Wounds%27_power_armor" target="_blank">Salt-Upon-Wounds' Power Armor</a> <span style="opacity:0.5;font-size:0.65rem;">[HH]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Sierra_Madre_armor" target="_blank">Sierra Madre Armor</a> <span style="opacity:0.5;font-size:0.65rem;">[DM]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Ulysses%27_duster" target="_blank">Ulysses' Duster</a> <span style="opacity:0.5;font-size:0.65rem;">[LR]</span>`,
        `<a href="https://fallout.fandom.com/wiki/Vera%27s_outfit" target="_blank">Vera's Outfit</a> <span style="opacity:0.5;font-size:0.65rem;">[DM]</span>`,
    ],
};

function renderUniqueArmor() {
    const div = document.getElementById('unique-armor-checklist'); div.innerHTML = '';
    Object.keys(uniqueArmorData).forEach(cat => {
        const safe = "a-" + cat.replace(/[&\s\(\)]+/g, '-').toLowerCase().replace(/-+/g,'-').replace(/-$/,'');
        let h = `<div class="header-row" id="h-${safe}" onclick="toggleCollapse('${safe}')"><h2>${cat}</h2><span class="cat-pct" id="pct-${safe}">0%</span></div><div class="grid-tidy" data-category="${safe}">`;
        uniqueArmorData[cat].forEach(w => {
            const tmp = document.createElement('div'); tmp.innerHTML = w;
            const plainName = (tmp.querySelector('a') || tmp).textContent.trim();
            const safeN = plainName.replace(/'/g, "\\'");
            h += `<div class="grid-item">
                <input type="checkbox" class="u-armor-check" onchange="calcCat('${safe}'); triggerAutosave();">
                <span style="flex:1;">${w}</span>
                <button class="uni-add-btn" title="ADD TO LOADOUT" onclick="addUniqueArmorToLoadout('${safeN}')">+</button>
            </div>`;
        });
        div.insertAdjacentHTML('beforeend', h + `</div>`);
    });
}

function addUniqueArmorToLoadout(name) {
    addArmor();
    const cards = document.querySelectorAll('#armor-list .gear-card');
    const card = cards[cards.length - 1];
    if (card) {
        card.querySelector('input[placeholder="APPAREL NAME..."]').value = name;
        const n = name.toUpperCase();
        const sel = card.querySelector('select');
        if (n.includes('POWER ARMOR') || n.includes('T-51') || n.includes('REMNANTS') || n.includes('TESLA ARMOR') || n.includes('ASHUR') || n.includes('PROTOTYPE MEDIC') || n.includes('LINDEN') || n.includes('SALT-UPON') || n.includes('TRIBAL POWER')) sel.value = 'POWER ARMOR';
        else if (n.includes('COMBAT') || n.includes('RANGER') || n.includes('RECON') || n.includes('LEATHER') || n.includes('METAL') || n.includes('ASSASSIN') || n.includes('STEALTH ARMOR') || n.includes('RIOT GEAR') || n.includes('SIERRA MADRE') || n.includes('GREAT KHAN')) sel.value = 'MEDIUM';
        else sel.value = 'LIGHT';
        triggerAutosave();
    }
    const btn = document.getElementById('tab-btn-gear');
    btn.style.boxShadow = '0 0 12px var(--pip-color)';
    btn.style.background = 'var(--pip-color)';
    btn.style.color = 'black';
    setTimeout(() => { if (!btn.classList.contains('active')) { btn.style.boxShadow = ''; btn.style.background = ''; btn.style.color = ''; } }, 800);
}

function searchUniqueArmor() { searchItems('uni-armor-search-bar', 'unique-armor-checklist'); }

function renderUniques() {
    const div = document.getElementById('unique-weapon-checklist'); div.innerHTML = '';
    const categoryOrder = ["PISTOLS & REVOLVERS", "SMGS & RIFLES", "SHOTGUNS", "BIG GUNS", "ENERGY WEAPONS", "EXPLOSIVES", "MELEE WEAPONS", "UNARMED"];
    categoryOrder.forEach(cat => {
        if (uniqueWeaponData[cat]) {
            const safe = "u-" + cat.replace(/[&\s]+/g, '-').toLowerCase();
            let h = `<div class="header-row" id="h-${safe}" onclick="toggleCollapse('${safe}')"><h2>${cat}</h2><span class="cat-pct" id="pct-${safe}">0%</span></div><div class="grid-tidy" data-category="${safe}">`;
            uniqueWeaponData[cat].forEach(w => {
                // Extract plain text name from the anchor tag
                const tmp = document.createElement('div'); tmp.innerHTML = w;
                const plainName = (tmp.querySelector('a') || tmp).textContent.trim();
                const safeN = plainName.replace(/'/g, "\\'");
                h += `<div class="grid-item">
                    <input type="checkbox" class="u-wpn-check" onchange="calcCat('${safe}'); triggerAutosave();">
                    <span style="flex:1;">${w}</span>
                    <button class="uni-add-btn" title="ADD TO LOADOUT" onclick="addUniqueToLoadout('${safeN}')">+</button>
                </div>`;
            });
            div.insertAdjacentHTML('beforeend', h + `</div>`);
        }
    });
}

function addUniqueToLoadout(name) {
    addWeapon();
    const cards = document.querySelectorAll('#weapon-list .gear-card');
    const card = cards[cards.length - 1];
    if (card) {
        card.querySelector('input[placeholder="WEAPON NAME..."]').value = name;
        triggerAutosave();
    }
    // Flash the loadout tab button briefly to guide the user
    const btn = document.getElementById('tab-btn-gear');
    btn.style.boxShadow = '0 0 12px var(--pip-color)';
    btn.style.background = 'var(--pip-color)';
    btn.style.color = 'black';
    setTimeout(() => {
        if (!btn.classList.contains('active')) {
            btn.style.boxShadow = '';
            btn.style.background = '';
            btn.style.color = '';
        }
    }, 800);
}

/* ===== RENDER: COLLECTIBLES ===== */
function renderCollectibles() {
    const div = document.getElementById('coll-list'); div.innerHTML = '';
    if(origin === 'CW') {
        div.innerHTML = `
            <div class="header-row" id="h-special-bobble" onclick="toggleCollapse('special-bobble')"><h2>BOBBLEHEADS: S.P.E.C.I.A.L.</h2></div>
            <div class="grid-tidy" data-category="special-bobble">${sKeys.map(s=>`<div class="grid-item"><input type="checkbox" onchange="triggerAutosave()"><span>${s}</span></div>`).join('')}</div>
            <div class="header-row" id="h-skill-bobble" onclick="toggleCollapse('skill-bobble')"><h2>BOBBLEHEADS: SKILLS</h2></div>
            <div class="grid-tidy" data-category="skill-bobble">${skills.map(s=>`<div class="grid-item"><input type="checkbox" onchange="triggerAutosave()"><span>${s}</span></div>`).join('')}</div>`;
    } else {
        div.innerHTML = `
            <div class="header-row" id="h-snow-base" onclick="toggleCollapse('snow-base')"><h2>SNOWGLOBES: BASE GAME</h2></div>
            <div class="grid-tidy" data-category="snow-base">${["GOODSPRINGS","STRIP","HOOVER DAM","MT. CHARLESTON","NELLIS","MORMON FORT","TEST SITE"].map(s=>`<div class="grid-item"><input type="checkbox" onchange="triggerAutosave()"><span>${s}</span></div>`).join('')}</div>
            <div class="header-row" id="h-snow-dlc" onclick="toggleCollapse('snow-dlc')"><h2>SNOWGLOBES: DLC</h2></div>
            <div class="grid-tidy" data-category="snow-dlc">${["SIERRA MADRE","ZION","BIG MT","THE DIVIDE"].map(s=>`<div class="grid-item"><input type="checkbox" onchange="triggerAutosave()"><span>${s}</span></div>`).join('')}</div>`;
    }
}

/* ===== CATEGORY COMPLETION ===== */
function calcCat(id) {
    const g = document.querySelector(`.grid-tidy[data-category="${id}"]`);
    if(!g) return;
    const checks = Array.from(g.querySelectorAll('input[type="checkbox"]'));
    const pct = Math.round((checks.filter(c => c.checked).length / checks.length) * 100);
    const pctEl = document.getElementById(`pct-${id}`);
    if(pctEl) pctEl.innerText = pct === 100 ? "DONE" : pct + "%";
    document.getElementById(`h-${id}`).classList.toggle('completed', pct === 100);
}

/* ===== UPDATE ALL ===== */
function updateAll() {
    const pool = (mode === 'hc' ? 30 : 33);
    const rem = pool - (Object.values(special).reduce((a,b)=>a+b,0) - 7);
    document.getElementById('pts-left').innerText = rem;
    document.getElementById('special-list').innerHTML = sKeys.map(k => `
        <div class="special-row"><span>${k}</span>
        <div class="special-controls">
            <button class="special-btn" onclick="mod('${k}',-1)" ${special[k]<=1?'disabled':''}>-</button>
            <b>${special[k]}</b>
            <button class="special-btn" onclick="mod('${k}',1)" ${rem<=0 || special[k]>=10?'disabled':''}>+</button>
        </div></div>`).join('');

    document.getElementById('ov-name').innerText = (document.getElementById('char-name').value || "NO_ID").toUpperCase();
    document.getElementById('ov-spec').innerHTML = sKeys.map(k => `<div><div style="font-size:0.6rem;">${k}</div><b>${special[k]}</b></div>`).join('');
    document.getElementById('ov-tags').innerHTML = Array.from(document.querySelectorAll('#tag-area input:checked')).map(c => `<div class="ov-entry"><span>${c.nextElementSibling.innerText}</span></div>`).join('') || "NONE";
    document.getElementById('ov-traits').innerHTML = Array.from(document.querySelectorAll('#trait-list input')).map(i => i.value ? `<div class="ov-entry"><span>• ${i.value}</span></div>` : '').join('') || "NONE";

    document.getElementById('ov-perks').innerHTML = Array.from(document.querySelectorAll('#prog-list .prog-row')).map(r => {
        const lvl = r.querySelector('.lvl-tag').innerText;
        const val = r.querySelector('.prog-name-input')?.value || '';
        return val ? `<div class="ov-entry"><span>${val}</span><span style="opacity:0.6;">${lvl}</span></div>` : '';
    }).join('') + Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).map(r => {
        const val = r.querySelector('.prog-name-input')?.value || '';
        return val ? `<div class="ov-entry"><span>${val}</span><span style="opacity:0.6;">BONUS</span></div>` : '';
    }).join('');

    let gearHTML = Array.from(document.querySelectorAll('#weapon-list .gear-card')).map(c => {
        const n = c.querySelector('input[placeholder="WEAPON NAME..."]').value;
        const a = c.querySelector('input[placeholder="AMMO TYPE..."]').value;
        return n ? `<div class="ov-entry"><span>⚔ ${n}</span><span style="opacity:0.6;">${a}</span></div>` : '';
    }).join('');
    gearHTML += Array.from(document.querySelectorAll('#armor-list .gear-card')).map(c => {
        const n = c.querySelector('input[placeholder="APPAREL NAME..."]').value;
        const w = c.querySelector('select').value;
        return n ? `<div class="ov-entry"><span>🛡 ${n}</span><span style="opacity:0.6;">${w}</span></div>` : '';
    }).join('');
    document.getElementById('ov-gear').innerHTML = gearHTML || "EMPTY";

    syncTagLimit();
}

function mod(k, v) { special[k] += v; updateAll(); reCheckAllPerkRows(); triggerAutosave(); }

function addTrait() {
    if(mode==='hc' && document.getElementById('trait-list').children.length>=5) return;
    document.getElementById('trait-list').insertAdjacentHTML('beforeend',
        `<div style="display:flex; margin-bottom:2px;"><input type="text" oninput="triggerAutosave()" style="flex:1; background:transparent; border:none; border-bottom:1px solid #444; color:#fff;" placeholder="TRAIT NAME..."><button onclick="this.parentElement.remove();updateAll();triggerAutosave();" style="color:red; background:none; border:none; cursor:pointer;">X</button></div>`);
    updateAll();
}

function addWeapon() {
    document.getElementById('weapon-list').insertAdjacentHTML('beforeend',
        `<div class="gear-card"><input type="text" oninput="triggerAutosave()" placeholder="WEAPON NAME..."><input type="text" oninput="triggerAutosave()" placeholder="LOCATION..."><input type="text" oninput="triggerAutosave()" placeholder="AMMO TYPE..."><button onclick="this.parentElement.remove();updateAll();triggerAutosave();" style="position:absolute; right:5px; top:5px; color:red; background:none; border:none; cursor:pointer;">X</button></div>`);
}

function addArmor() {
    document.getElementById('armor-list').insertAdjacentHTML('beforeend',
        `<div class="gear-card"><input type="text" oninput="triggerAutosave()" placeholder="APPAREL NAME..."><input type="text" oninput="triggerAutosave()" placeholder="LOCATION..."><select onchange="triggerAutosave()"><option>LIGHT</option><option>MEDIUM</option><option>HEAVY</option><option>POWER ARMOR</option></select><button onclick="this.parentElement.remove();updateAll();triggerAutosave();" style="position:absolute; right:5px; top:5px; color:red; background:none; border:none; cursor:pointer;">X</button></div>`);
}

function addExtraPerk() {
    document.getElementById('extra-perk-list').insertAdjacentHTML('beforeend', makeProgRow('BONUS PERK', false, true));
}

/* ===== PROGRESSION AUTOCOMPLETE ENGINE ===== */
let _acCloseTimer = null;

function onProgNameInput(input) {
    const row = input.closest('.prog-row');
    const dropdown = row.querySelector('.prog-ac-dropdown');
    const query = input.value.trim().toUpperCase();

    // If empty, just hide
    if (!query) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; return; }

    // Filter perks
    const matches = PERKS_DATA.filter(p =>
        p.name.toUpperCase().includes(query) || p.req.toUpperCase().includes(query)
    ).slice(0, 12);

    if (!matches.length) {
        dropdown.innerHTML = `<div class="ac-no-results">NO MATCHING PERKS</div>`;
        dropdown.style.display = 'block';
        return;
    }

    dropdown.innerHTML = matches.map((p, i) => {
        const multiLabel = p.ranks > 1 ? ` <span style="color:var(--pip-color);font-size:0.58rem;">[★${p.ranks}]</span>` : '';
        const safeName = p.name.replace(/'/g, '&#39;').replace(/"/g, '&quot;');
        return `<div class="prog-ac-item" data-idx="${i}"
            onmousedown="selectPerkInRow(this.closest('.prog-row'), ${JSON.stringify(p.name)})">
            <span class="ac-item-name">${p.name}${multiLabel}</span>
            <span class="ac-item-req">${p.req}</span>
        </div>`;
    }).join('');
    dropdown.style.display = 'block';
}

function onProgNameKey(e, input) {
    const row = input.closest('.prog-row');
    const dropdown = row.querySelector('.prog-ac-dropdown');
    const items = Array.from(dropdown.querySelectorAll('.prog-ac-item'));
    if (!items.length) { if (e.key === 'Enter') triggerAutosave(); return; }

    const focused = dropdown.querySelector('.ac-focused');
    let idx = focused ? parseInt(focused.dataset.idx) : -1;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        idx = Math.min(idx + 1, items.length - 1);
        items.forEach(i => i.classList.remove('ac-focused'));
        items[idx].classList.add('ac-focused');
        items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        idx = Math.max(idx - 1, 0);
        items.forEach(i => i.classList.remove('ac-focused'));
        items[idx].classList.add('ac-focused');
        items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focused) { selectPerkInRow(row, focused.querySelector('.ac-item-name').textContent.replace(/\[★\d+\]/g,'').trim()); }
        else { dropdown.style.display = 'none'; triggerAutosave(); }
    } else if (e.key === 'Escape') {
        dropdown.style.display = 'none';
    }
}

function scheduleCloseAC(input) {
    _acCloseTimer = setTimeout(() => {
        const row = input.closest('.prog-row');
        if (row) { const d = row.querySelector('.prog-ac-dropdown'); if(d) d.style.display='none'; }
        triggerAutosave();
    }, 180);
}

// Map perk req abbreviations → special object keys
const REQ_STAT_MAP = { STR:'STR', PER:'PER', END:'END', CHR:'CHA', INT:'INT', AGL:'AGI', LCK:'LCK' };
const STAT_FULL = { STR:'Strength', PER:'Perception', END:'Endurance', CHR:'Charisma', INT:'Intelligence', AGL:'Agility', LCK:'Luck' };

function checkPerkRequirements(row, perk) {
    const warningEl = row.querySelector('.prog-req-warning');
    if (!warningEl) return;

    const failures = [];
    const reqStr = perk.req;

    // --- Level check ---
    const lvlMatch = reqStr.match(/Level\s+(\d+)/i);
    if (lvlMatch) {
        const reqLvl = parseInt(lvlMatch[1]);
        const tagText = row.querySelector('.lvl-tag')?.textContent || '';
        const rowLvl = parseInt(tagText.match(/\d+/)?.[0] || '0');
        if (rowLvl > 0 && rowLvl < reqLvl) {
            failures.push(`LEVEL: slot is Lvl ${rowLvl}, perk needs Lvl ${reqLvl}`);
        }
    }

    // --- SPECIAL checks ---
    // Split req by "," → top-level AND chunks. Each chunk may have OR alternatives.
    // We only flag if the player fails ALL alternatives in a chunk.
    // Chunks that mix SPECIAL with skills (e.g. "AGL 6 or Guns 50") are skipped
    // because we don't track skills here.
    const chunks = reqStr.split(',').map(s => s.trim());

    for (const chunk of chunks) {
        if (/^Level\s/i.test(chunk)) continue; // skip level chunk

        const parts = chunk.split(/\s+or\s+/i);
        const statReqs = [];
        let hasNonStat = false;

        for (const part of parts) {
            // Is this part a SPECIAL stat requirement?
            const capMatch = part.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\s*</i);
            const minMatch = part.match(/\b(STR|PER|END|CHR|INT|AGL|LCK)\s+(\d+)/i);
            if (capMatch) {
                // Upper-bound requirement (e.g. STR < 6) — skip, it's a cap not a minimum
                hasNonStat = true; // treat as non-blocking for our purposes
            } else if (minMatch) {
                statReqs.push({ abbr: minMatch[1].toUpperCase(), needed: parseInt(minMatch[2]) });
            } else {
                hasNonStat = true; // skill, karma, named perk prerequisite etc.
            }
        }

        if (statReqs.length === 0) continue; // no SPECIAL minimums to check
        // If there's a non-stat OR alternative, the player might meet that — don't warn
        if (hasNonStat && parts.length > 1) continue;

        // Check if ANY stat req in this chunk is met (OR logic)
        const anyMet = statReqs.some(r => {
            const key = REQ_STAT_MAP[r.abbr];
            return key && (special[key] ?? 0) >= r.needed;
        });

        if (!anyMet) {
            if (statReqs.length === 1) {
                const r = statReqs[0];
                const cur = special[REQ_STAT_MAP[r.abbr]] ?? 0;
                failures.push(`${STAT_FULL[r.abbr]}: need ${r.abbr} ${r.needed}, have ${cur}`);
            } else {
                const opts = statReqs.map(r => `${r.abbr} ${r.needed}`).join(' or ');
                const vals = statReqs.map(r => `${r.abbr}:${special[REQ_STAT_MAP[r.abbr]]??0}`).join(' / ');
                failures.push(`SPECIAL: need ${opts} (have ${vals})`);
            }
        }
    }

    if (failures.length) {
        warningEl.innerHTML = `<div class="req-warn-label">⚠ REQUIREMENTS NOT MET:</div>` +
            failures.map(f => `<div class="req-warn-item">${f}</div>`).join('');
        warningEl.style.display = 'block';
        row.classList.add('req-fail');
    } else {
        warningEl.innerHTML = '';
        warningEl.style.display = 'none';
        row.classList.remove('req-fail');
    }
}

function reCheckAllPerkRows() {
    document.querySelectorAll('#prog-list .prog-row, #extra-perk-list .prog-row').forEach(row => {
        const name = (row.querySelector('.prog-name-input')?.value || '').trim();
        if (!name) return;
        const perk = PERKS_DATA.find(p => p.name.toUpperCase() === name.toUpperCase())
            || PERKS_DATA.find(p => name.toUpperCase().startsWith(p.name.toUpperCase()));
        if (perk) checkPerkRequirements(row, perk);
    });
}

function selectPerkInRow(row, perkName) {
    if (_acCloseTimer) { clearTimeout(_acCloseTimer); _acCloseTimer = null; }
    const perk = PERKS_DATA.find(p => p.name === perkName);
    if (!perk) return;

    const nameInput = row.querySelector('.prog-name-input');
    const dropdown = row.querySelector('.prog-ac-dropdown');
    const info = row.querySelector('.prog-perk-info');
    const reqEl = row.querySelector('.prog-perk-req');
    const descEl = row.querySelector('.prog-perk-desc');
    const badge = row.querySelector('.prog-rank-badge');
    const clearBtn = row.querySelector('.prog-clear-btn');

    nameInput.value = perk.name;
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';

    reqEl.textContent = 'REQ: ' + perk.req;
    descEl.textContent = perk.desc;
    info.style.display = 'block';

    const multiRank = perk.ranks > 1;
    badge.textContent = multiRank ? `★ ${perk.ranks} RANKS` : `1 RANK`;
    badge.style.display = 'inline';
    badge.classList.toggle('multi', multiRank);
    clearBtn.style.display = 'inline';
    row.classList.add('has-perk');

    // Check requirements against current level + SPECIAL
    checkPerkRequirements(row, perk);

    // If Intense Training, trigger SPECIAL picker
    if (perk.name.trim().toUpperCase() === 'INTENSE TRAINING') {
        openITModal(perk.name, perk.req);
    }

    triggerAutosave();
}

function tryHydratePerkRow(row, name) {
    if (!name) return;
    const perk = PERKS_DATA.find(p => p.name.toUpperCase() === name.toUpperCase())
        || PERKS_DATA.find(p => name.toUpperCase().startsWith(p.name.toUpperCase()));
    if (perk) {
        selectPerkInRow(row, perk.name);
        // Restore actual typed name (may include IT annotation)
        row.querySelector('.prog-name-input').value = name;
    } else {
        // Plain text — just show it, no extra info
        row.querySelector('.prog-name-input').value = name;
    }
}

function clearProgRow(btn) {
    const row = btn.closest('.prog-row');
    row.querySelector('.prog-name-input').value = '';
    row.querySelector('.prog-notes-input').value = '';
    row.querySelector('.prog-perk-info').style.display = 'none';
    row.querySelector('.prog-rank-badge').style.display = 'none';
    row.querySelector('.prog-clear-btn').style.display = 'none';
    row.classList.remove('has-perk', 'req-fail');
    const warn = row.querySelector('.prog-req-warning');
    if (warn) { warn.style.display = 'none'; warn.innerHTML = ''; }
    triggerAutosave();
}

function makeProgRow(levelLabel, isTrait, removable) {
    const tagClass = isTrait ? 'lvl-tag is-trait' : 'lvl-tag';
    const removeBtn = removable
        ? `<button onclick="this.closest('.prog-row').remove();updateAll();triggerAutosave();" style="margin-left:auto;font-size:0.6rem;border:1px solid rgba(255,0,0,0.4);color:rgba(255,80,80,0.8);padding:2px 8px;cursor:pointer;background:rgba(255,0,0,0.05);border-bottom:1px solid rgba(255,0,0,0.4)!important;">✕ REMOVE</button>`
        : '';
    return `<div class="prog-row">
        <div class="prog-card-header">
            <span class="${tagClass}">${levelLabel}</span>
            <span class="prog-rank-badge"></span>
            <button class="prog-clear-btn" onclick="clearProgRow(this)">✕ CLEAR</button>
            ${removeBtn}
        </div>
        <div class="prog-input-wrap">
            <input type="text" class="prog-name-input" autocomplete="off"
                placeholder="TYPE TO SEARCH PERKS..."
                oninput="onProgNameInput(this)"
                onkeydown="onProgNameKey(event,this)"
                onblur="scheduleCloseAC(this)"
                onfocus="onProgNameInput(this)">
            <div class="prog-ac-dropdown"></div>
        </div>
        <div class="prog-perk-info">
            <div class="prog-req-warning" style="display:none;"></div>
            <div class="prog-perk-req"></div>
            <div class="prog-perk-desc"></div>
        </div>
        <input type="text" class="prog-notes-input" placeholder="NOTES / REQUIREMENTS..." oninput="triggerAutosave()">
    </div>`;
}

function renderProgression() {
    const div = document.getElementById('prog-list'); div.innerHTML = '';
    for(let i=2; i<=30; i++) {
        const isP = mode === 'std' ? (i%2===0) : (i%3===0);
        const isT = (i>=5 && (i-5)%4===0);
        // Emit PERK first, then TRAIT — each gets its own row so both are preserved
        if(isP) div.insertAdjacentHTML('beforeend', makeProgRow(`LVL ${i} PERK`, false, false));
        if(isT) div.insertAdjacentHTML('beforeend', makeProgRow(`LVL ${i} TRAIT`, true, false));
    }
}

function syncTagLimit() {
    const cbs = Array.from(document.querySelectorAll('#tag-area input'));
    const count = cbs.filter(c => c.checked).length;
    cbs.forEach(c => {
        if(!c.checked && count >= 3) { c.disabled = true; c.parentElement.classList.add('locked'); }
        else { c.disabled = false; c.parentElement.classList.remove('locked'); }
    });
    document.getElementById('add-trait-btn').disabled = (mode==='hc' && document.getElementById('trait-list').children.length>=5);
}

/* ===== AUTOSAVE & PERSISTENCE ===== */
function triggerAutosave() {
    const data = collectData();
    localStorage.setItem('Nuclear_Sunset_Permanent_Vault', JSON.stringify(data));
    document.getElementById('sync-status').innerText = "V_MEMORY_SYNCED_" + new Date().toLocaleTimeString();
    updateAll();
}

function collectData() {
    regionalStorage[origin].quests = Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked);
    regionalStorage[origin].colls = Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked);
    return {
        name: document.getElementById('char-name').value, special, mode, origin,
        regionalStorage,
        notes: document.getElementById('user-notes').value,
        tags: Array.from(document.querySelectorAll('#tag-area input')).map(i => i.checked),
        traits: Array.from(document.querySelectorAll('#trait-list input')).map(i => i.value),
        perks: Array.from(document.querySelectorAll('#prog-list .prog-row')).map(r => [
            r.querySelector('.prog-name-input')?.value || '',
            r.querySelector('.prog-notes-input')?.value || ''
        ]),
        extraPerks: Array.from(document.querySelectorAll('#extra-perk-list .prog-row')).map(r => [
            r.querySelector('.prog-name-input')?.value || '',
            r.querySelector('.prog-notes-input')?.value || ''
        ]),
        weapons: Array.from(document.querySelectorAll('#weapon-list .gear-card')).map(c => Array.from(c.querySelectorAll('input')).map(i => i.value)),
        armor: Array.from(document.querySelectorAll('#armor-list .gear-card')).map(c => [c.querySelector('input[placeholder="APPAREL NAME..."]').value, c.querySelector('input[placeholder="LOCATION..."]').value, c.querySelector('select').value]),
        quests: Array.from(document.querySelectorAll('#quest-list-container input')).map(i => i.checked),
        colls: Array.from(document.querySelectorAll('#coll-list input')).map(i => i.checked),
        uniWpns: Array.from(document.querySelectorAll('.u-wpn-check')).map(i => i.checked),
        uniArmor: Array.from(document.querySelectorAll('.u-armor-check')).map(i => i.checked)
    };
}

function exportJSON() {
    const data = collectData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${data.name || 'dweller'}.json`; a.click();
}

function importJSON(e) {
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            const raw = JSON.parse(ev.target.result);
            const safe = sanitizeImport(raw);
            if (!safe) { alert('IMPORT ERROR: INVALID FILE FORMAT'); return; }
            hydrate(safe);
        } catch(err) {
            alert('IMPORT ERROR: COULD NOT PARSE JSON FILE');
        }
    };
    reader.readAsText(e.target.files[0]);
    e.target.value = '';
}

function hydrate(d) {
    if(!d) return;
    special = d.special;
    document.getElementById('char-name').value = d.name || "";
    document.getElementById('user-notes').value = d.notes || "";
    if(d.regionalStorage) regionalStorage = d.regionalStorage;
    setMode(d.mode, true);
    setOrigin(d.origin, true);
    const tI = document.querySelectorAll('#tag-area input');
    d.tags.forEach((c, i) => { if(tI[i]) tI[i].checked = c; });
    document.getElementById('trait-list').innerHTML = '';
    d.traits.forEach(v => { if(v) { addTrait(); document.querySelector('#trait-list div:last-child input').value = v; }});
    document.getElementById('weapon-list').innerHTML = '';
    d.weapons.forEach(v => { addWeapon(); const i = document.querySelectorAll('#weapon-list .gear-card:last-child input'); i[0].value = v[0]; i[1].value = v[1]; i[2].value = v[2]; });
    document.getElementById('armor-list').innerHTML = '';
    d.armor.forEach(v => { addArmor(); const c = document.querySelector('#armor-list .gear-card:last-child'); c.querySelector('input[placeholder="APPAREL NAME..."]').value = v[0]; c.querySelector('input[placeholder="LOCATION..."]').value = v[1]; c.querySelector('select').value = v[2]; });
    const pI = document.querySelectorAll('#prog-list .prog-row');
    d.perks.forEach((v, i) => {
        if(pI[i]) {
            tryHydratePerkRow(pI[i], v[0] || '');
            const ni = pI[i].querySelector('.prog-notes-input'); if(ni) ni.value = v[1] || '';
        }
    });
    document.getElementById('extra-perk-list').innerHTML = '';
    if (d.extraPerks) d.extraPerks.forEach(v => {
        addExtraPerk();
        const ep = document.querySelector('#extra-perk-list .prog-row:last-child');
        if(ep) {
            tryHydratePerkRow(ep, v[0] || '');
            const ni = ep.querySelector('.prog-notes-input'); if(ni) ni.value = v[1] || '';
        }
    });
    const uC = document.querySelectorAll('.u-wpn-check');
    if(d.uniWpns) d.uniWpns.forEach((c, i) => { if(uC[i]) uC[i].checked = c; });
    const uA = document.querySelectorAll('.u-armor-check');
    if(d.uniArmor) d.uniArmor.forEach((c, i) => { if(uA[i]) uA[i].checked = c; });
    updateAll();
    reCheckAllPerkRows();
}

function purgeMemory() { if(confirm("INITIATE TOTAL ATOMIC ANNIHILATION?")) { localStorage.clear(); location.reload(); } }

/* ===== INITIALIZATION ===== */
window.onload = () => {
    document.getElementById('tag-area').innerHTML = skills.map(s => `<div class="grid-item"><input type="checkbox" onchange="triggerAutosave()"><span>${s}</span></div>`).join('');
    renderUniques();
    renderUniqueArmor();
    const saved = localStorage.getItem('Nuclear_Sunset_Permanent_Vault');
    if (saved) {
        try {
            const raw = JSON.parse(saved);
            const safe = sanitizeImport(raw);
            if (safe) hydrate(safe);
            else { setMode('std', true); setOrigin('CW', true); }
        } catch(e) {
            setMode('std', true); setOrigin('CW', true);
        }
    } else {
        setMode('std', true);
        setOrigin('CW', true);
    }
};
