// data.js
// Thousand Year Old Vampire - Standard Prompt Database (1-80)

// Meaning Oracle table: 100 evocative words, indexed 1..100 by a d100 roll
// (entries 1-50 = "Element 1", 51-100 = "Element 2"). Used by the floating
// oracle to spark ideas; not part of the rules-as-written.
const meaningTable = [
    'Abandon', 'Age', 'Ancestor', 'Antique', 'Art', 'Artifact', 'Ash', 'Beast', 'Betray', 'Blood',
    'Bone', 'Burn', 'Century', 'Change', 'Child', 'Coin', 'Continue', 'Cult', 'Curse', 'Dark',
    'Death', 'Decay', 'Deceive', 'Decrease', 'Descendant', 'Destroy', 'Diary', 'Disease', 'Dream', 'Dust',
    'Empire', 'Enemy', 'Escape', 'Extra', 'Faded', 'Feast', 'Feral', 'Flee', 'Forget', 'Forgive',
    'Friend', 'Generation', 'Ghost', 'Grave', 'Grief', 'Guilt', 'Hide', 'History', 'Hoard', 'Hunger',
    'Hunt', 'Identity', 'Illness', 'Immortal', 'Imprison', 'Increase', 'Innocent', 'Knowledge', 'Lair', 'Legend',
    'Lineage', 'Loss', 'Love', 'Mark', 'Mask', 'Memory', 'Monster', 'Mortal', 'Mundane', 'Murder',
    'Mysterious', 'Myth', 'Night', 'Oblivion', 'Obscure', 'Parasite', 'Plague', 'Power', 'Predator', 'Prey',
    'Regret', 'Relic', 'Resource', 'Ritual', 'Ruin', 'Secret', 'Shadow', 'Skill', 'Sleep', 'Society',
    'Start', 'Starve', 'Stop', 'Strange', 'Sun', 'Time', 'Tomb', 'Treasure', 'Vengeance', 'Victim'
];

const promptDB = {
    1: {
        a: "In your blood-hunger, you destroy someone close to you. Kill a mortal Character. Create a mortal if none are available. Take the skill Bloodthirsty.",
        b: "You are overcome by panic and maul someone close to you, accidentally turning them into a monster like yourself. Convert a beloved mortal Character into an enemy immortal. Take the Skill Ashamed.",
        c: "You are captured and enslaved by a wicked and powerful supernatural entity. Create an immortal Character. How do you eventually escape their servitude? Check a Skill and take the Skill Humans are Cattle. Strikeout all mortal Characters, as a hundred years, have passed. Take a Resource you have used for evil while in service to your former master."
    },
    2: {
        a: "Horrified at your new nature, you withdraw from society. Where do you hide? How do you feed? Create a stationary Resource which shelters you",
        b: "You reinvent your existence around the seclusion of your hiding place. You begin to work in an artful way, changing your living environment. How do you come to appreciate beauty or craft in a new way? Create a Skill based on a Memory.",
        c: "Your hiding place is destroyed by mortals. What steps had you taken to ensure your survival? What revenge do you wreak upon your persecutors? Degrade a Resource into ruins. Take the Skill Vile Acts."
    },
    3: {
        a: "A loved one discovers your condition and works to help you. Create a Resource which represents their assistance. Create a mortal Character if none are available.",
        b: "You manipulate this mortal into committing atrocious deeds on your behalf. What do you do when they quail at these awful tasks? Take the Skill Humans are Tools.",
        c: "At the end of the mortal’s life you convert them into a mindless meat machine, an undying thing from which you feed. What regrets do you have? Change the Character to a Resource. Check a Skill."
    },
    4: {
        a: "You are exposed and flee to a neighboring region. Lose any stationary Resources. Check a Skill. A mortal flees with you. What new name do you adopt among these strangers?",
        b: "You are adopted into a strange cult who take you in despite (or because of) your outlander origin. Check a Skill and create a Resource, The Secret Cabal. How did they find you? What vile initiation ceremony do you undergo? Do they know what you are?",
        c: "The Secret Cabal, without your knowledge, performs a dark ceremony that changes a mortal Character into a horrific, alien, and immortal thing. Convert a mortal Character into an immortal enemy. What alien objectives does this new immortal pursue? Did the Cabal manipulate you into helping with this creation? How does this change your relationship with the Cabal?"
    },
    5: {
        a: "You murder someone you love or respect rather than let them expose you. Kill a Character. Check a Skill. If you have no living Characters, kill no one, and create a beloved mortal Character who you have betrayed.",
        b: "A Character you’ve victimized comes to you in a dream. Do they curse or forgive you? Receive a Mark.",
        c: "Love hidden within your soul propels you on a foolish quest for absolution from some great guilt. What wrong did you try to right? How do you fail and make everything much, much worse? Lose a Resource. Check a Skill."
    },
    6: {
        a: "A mortal Character begins serving you. Who are they? Why are they drawn to you? Create a new mortal Character.",
        b: "A trusted mortal Character betrays you in a surprising way. Lose a Resource. Why did they do this? Why do you forgive them?",
        c: "A mortal Character sacrifices themselves to save you. Check a Skill. Gain a Skill relevant to love or trust."
    },
    7: {
        a: "Your body manifests a trait related to the vampire that created you. How do you become more like them? Create a Skill that reflects this.",
        b: "People see a horror in you that you cannot perceive in yourself. What Mark do you possess that you do not know about? Create a Mark and a suspicious mortal who has seen it. What name do the people call you when your back is turned?",
        c: "Through grim work with iron and fire, you remove a Mark. Record an Experience of pain and blood. Who do you blame? You may remove a Mark or replace an existing Mark with something worse."
    },
    8: {
        a: "You are recognized for what you are by another creature like yourself. Create an immortal Character, lose a Resource, and gain a Skill. What did you lose to them?",
        b: "You gain an advantage over an immortal Character. What do you take from them? What do you learn? Convert a Memory to a Skill; strikeout that Memory. Gain a mysterious Resource.",
        c: "A Character you’ve angered has powerful allies. Create a new enemy immortal Character who is the face of this mysterious group which harries you. Check a Skill to escape their grasp. Take the Skill Time to Leave. Move to a far-off region and lose any stationary Resources. Take a new name."
    },
    9: {
        a: "You develop a system for feeding. What is it? What happens to those who die? Create a Skill that reflects this.",
        b: "You not only drink their blood but financially profit from your victims as well! How do you arrange this? What atrocity do you commit to protect this system? Check a Skill, create a Resource.",
        c: "Another Character usurps your feeding system and improves it. Do you crawl back to your ouster, begging to be let back in? If so, then gain the Skill Belly on the Ground. If you instead build a new feeding system from scratch, check two Skills, and gain one Resource."
    },
    10: {
        a: "The stars pinwheel above you in the night. The seasons are a blur. You are as an automaton, unconscious of the passage of decades. A century passes. Strikeout a Memory. Strikeout all mortal Characters.",
        b: "A potent artifact, religious or magical or technological, falls into your hands. With it, you can remake the world. What is this thing? Who seeks it? Create a mortal Character. Add the item as a Resource. If you still have it when you achieve any game-ending result, you may rewrite the ending as you like. You must lose this item first if you lose Resources in an encounter with an immortal Character.",
        c: "While fiddling with the artifact you accidentally bring about the end times. Devils rise, angels fall, spirits are made manifest. Human populations are levied in a war which will last centuries and decide the fate of the cosmos itself. Create a Character or Resource that represents the manifestation of a supernatural conflict that fits your story up to this point. Create two immortal Characters aligned with either side of the conflict who are now interested in your Vampire."
    },
    11: {
        a: "How do you find solace from the raging hunger within you? You may lose one checked or unchecked Skill.",
        b: "You discover an internal focus which lets you maintain control of your vampire self. Lose a violent Memory and take the Skill I Control the Beast and rewrite any unchecked Skill as something new. What new name do you take to distance yourself from what you once were? How is the name symbolic?",
        c: "Your control breaks. You slaver and kill and revel in blood. You are your hunger. What were the last words of your closest friendly Character, mortal or immortal, as you feasted upon them? Change a beloved Memory to a lie in which you murder to protect yourself. Create a Skill that invokes the name of a dead Character in a mocking way."
    },
    12: {
        a: "New laws or social mores make it harder for you to hide among the populace. How are you nearly caught and destroyed? Check a Skill. Create a Skill. Create a mortal criminal who assists you.",
        b: "Working across generations you change the laws of society to your advantage. How do you bend leaders to your will? What do you change? Create a Resource.",
        c: "A mortal protégé outstrips you. They are smarter, crueler, and more capable than you can ever be. They lock you in a dungeon—for what purpose do they use you? Create a wicked mortal Character."
    },
    13: {
        a: "Generations of the same family serve you. This line starts from any living mortal Character, or from the descendants of a dead mortal Character. What bizarre rituals do they tie to their servitude? Lose a Resource and create a Servitor of the Lineage Resource.",
        b: "Your servants are numerous, enthusiastic, and sometimes useless. Create a Skill based on a Memory, this is the Skill you use to control them.",
        c: "Your servants bring you a gift you do not want. Create a problematic Resource."
    },
    14: {
        a: "An enemy Character uses a lost Resource to turn your few friends against you. Check three Skills to regain the Resource, or check one Skill to barely survive. Which former friend did you kill? Where do you flee?",
        b: "You were born in a time and place much different than that in which you find yourself now. What values must you set aside to survive in this strange world? Create an appropriate contemporary Skill based on your most recent Memory. What new name have you recently adopted?",
        c: "How do you rise to a position of leadership in this place? What neighbors or populations do you subjugate through war and violence? Gain a Resource you took from someone who wanted nothing but peace."
    },
    15: {
        a: "While traveling you come into conflict with another immortal. Gain a Mark. Who are they? What trick did you play upon them? Create a new immortal Character.",
        b: "An immortal proves to be much more than they appear. Check a Skill or else lose a Resource or Memory. Gain a Resource or Skill.",
        c: "How does human society change drastically due to the meddling of immortals like yourself? Who benefits? What Resource do you lose? Gain one Resource, Skill, or Mark."
    },
    16: {
        a: "Some mortals have banded together to hunt you, well-armed, and wise to your tricks. How do you defeat or evade them? Create a mortal hunter related to one of your checked Skills. Check a Skill.",
        b: "The hunters are persistent, capable, and well-informed. They know things about you that you don’t. Create a Mark that is revealed in a confrontation. You are driven into hiding in an unpeopled wasteland. Lose any stationary Resources. Learn a new Skill related to this desolate region. What new name comes to you in loneliness?",
        c: "Returning to civilization you wreak a terrible vengeance upon the hapless descendants of your harassers. Songs will be sung of their suffering for a thousand years. Historians will use it as a benchmark for evil. Create a mortal Character that was innocent and good until you exacted your toll. Do not actually write down what acts you committed against these people."
    },
    17: {
        a: "You commit a despicable murder, but not for the sake of feeding. Why? Check a Skill. Remove a mortal Character, if you like.",
        b: "You are hounded for your crime. Check a Skill, lose a Resource. Confess your crime to any Character. Convert an enemy to a friend or a friend to an enemy. If you must create a Character, you become lovers.",
        c: "You fight a duel with a beloved Character, create one if you have none. Check a violent Skill or appropriate Resource and win by killing them, or gain a Mark and flee to another land."
    },
    18: {
        a: "You have fed too long in one place, destroying a community or social group. Who were they? How did the last community member die? Gain a scavenged Resource, lose a Resource.",
        b: "A community outcast has survived and vows to revenge themselves upon you. How did you know them? How did they know to catch you at your most vulnerable? Create a mortal Character bent on your destruction.",
        c: "You are hounded out of the land. Lose any stationary Resources. Check one Skill to escape, two to destroy your persecutor, three to make amends."
    },
    19: {
        a: "Two friendly Characters become embroiled in an internecine conflict. Become involved and check a Skill. Create up to two Characters, if needed. How do you profit? Gain a Resource.",
        b: "You scheme while your friends make war on one another. Manipulate the conflict to destroy any Character.",
        c: "Too much fighting, too much blood. Acting as peacemaker you try to end the conflict between former friends, but they both turn on you. Lose a Resource. Gain a Mark."
    },
    20: {
        a: "There is a great shift in the way society moves goods. How does this work to your advantage? Check a Skill. Create a Skill based on a Memory.",
        b: "Your vampiric state enables you to manipulate people across generations, using them to your own advantage. Create one stationary Resource and one ostentatious Resource that symbolizes wealth and power.",
        c: "Living off investments and rents makes you lazy and blunts your hunting edge. Check a Skill that is cruel or grasping, lose a checked Skill related to creativity or effort. Gain a stationary Resource that you didn’t truly earn."
    },
    21: {
        a: "You are trapped outside when the sun rises and take shelter someplace you are not supposed to be. A child discovers and befriends you. Create a mortal child Character and record a humanizing Experience.",
        b: "The child teaches you to appreciate the world again. You see small things, you smile. Create a Skill based on a pleasant Memory.",
        c: "Decades pass. The child has died of old age. You stand at their grave. What more could you have done to make their life better? How did you betray them? Strikeout that Character with great ceremony."
    },
    22: {
        a: "Create a mortal Character. You have shaped them from infancy to be exactly what you want. Lose a Resource.",
        b: "Create a mortal Character. You have shaped them from infancy to be exactly what you want. Lose a Resource.",
        c: "You become a loner embedded in the now, manipulating a hundred threads to stay fed and safe. Lose a Memory slot permanently. Take the Skill Feral Cunning."
    },
    23: {
        a: "You master a strange new science or field of knowledge. How does your vampire nature give you special insight into these studies? Create an appropriate Skill based on a Memory.",
        b: "You strike up a long correspondence and fall in love. Create a mortal Character. Go to them by giving up a Resource, or smother the love and lose a Memory.",
        c: "Your mortal love dies through the machinations of another Character unless you check one Skill. If you do save them they will instead die of sickness, or accident, or old age. Either way, you keep a token by which to remember them. Create a Resource."
    },
    24: {
        a: "You are forced to adopt a new name. Why?",
        b: "Erase the first sentence of any two Memories. You’re not quite sure why. Do not create an Experience about this.",
        c: "One place is as another to you, and you simply stop returning home. Lose a stationary Resource. Where do you wander?"
    },
    25: {
        a: "Your methods for acquiring victims are no longer effective. What has changed? Lose a Resource and create a Skill which describes your new feeding techniques.",
        b: "What physical labors are necessary to utilize this method? Create a simple, practical Skill and strike out a Memory.",
        c: "A mortal Character discovers your feeding system. What compelling argument do they use to get you to abandon it? Check a Skill."
    },
    26: {
        a: "You accidentally create a vampire through sloppy feeding. Create an immortal Character from an existing mortal Character. Why do you not destroy them? Check a Skill.",
        b: "This immortal Character lurks on the fringes of your existence. They become an embodiment of one of your least savory checked Skills. How do they act when your paths cross? What disturbing gift do they give you? Create a Resource.",
        c: "This immortal Character falls into the hands of mortals, indirectly imperiling your existence. Save them by checking three Skills. Lose three Resources if you do not save them. If you cannot lose all three Resources, lose as many as possible and flee to a new land. From now on all humans know vampires are real."
    },
    27: {
        a: "Wars rage throughout the region in which you reside. You withdraw into a hidden retreat, waiting for them to pass. Lose a Resource.",
        b: "Your secretive ways result in you being arrested as a spy. Check a Skill to escape or lose a Resource and gain a Mark from the experiments performed upon you. Either way, create a mortal who heads a well-funded organization that imperils creatures such as yourself.",
        c: "You become a spy, selling out the land you call home. Gain two Resources. Check a Skill, gain a Skill, uncheck an ancient and surprising Skill. Which Character suffers and dies because of your actions?"
    },
    28: {
        a: "A long-dead mortal Character returns. What do they want from you? How have they survived death? You only recognize them if you still have a related Memory. Check a Skill.",
        b: "What peril do they pull down upon you? Create a new enemy Character, mortal or immortal. Check a Skill or lose a Resource.",
        c: "You are ceaselessly hunted by potent, supernatural beings. Describe the methods you develop to avoid detection. Lose a Memory to gain a Skill or Resource, or do not lose a Memory and create a mortal servitor."
    },
    29: {
        a: "You are exposed as a monster and flee to a far-off land. Lose any stationary Resources. You do not know the language of this new place. How do you overcome this obstacle? What new name do you take?",
        b: "You disguise yourself with an entirely new persona. Take an old Memory and modify it to make it contemporary and bland. Create a Skill based on blending in.",
        c: "You lose yourself in your assumed personality. Lose your oldest and newest Memories. Throw away your Diary. Create a Skill and Resource tied to your new life."
    },
    30: {
        a: "What social mores have your forgotten? Lose a checked Skill.",
        b: "You feel a love forbidden by the convention of mortals around you. Create a new Character. Lose a Resource.",
        c: "You reinvent yourself and how you relate to the world. Uncheck a Skill."
    },
    31: {
        a: "You fall into a deep slumber for a hundred years. Strikeout any mortal Characters.",
        b: "You recognize the descendant of a dead mortal who features in one of your Memories and feel compelled to make their acquaintance. How do you share knowledge about their ancestor without revealing your monstrous nature? How is this conversation awkward? Gain a contemporary and unexpected Skill. Create a mortal Character, a new friend.",
        c: "Your mortal friend discovers family documents that reveal you for what you are. How does your relationship change? You may regain a forgotten Memory related to the mortal’s ancestor."
    },
    32: {
        a: "You keep a prisoner. Why this particular person? Why don’t you feed upon them? Create a Character and a Skill related to keeping them captive.",
        b: "Mortals rescue your prisoner. Create two mortal rescuers. Lose a Resource.",
        c: "Your prisoner returns to you, but on their own terms. What is this strange new relationship?"
    },
    33: {
        a: "You know where the old things are. Create a Resource and make an enemy Character into a friend.",
        b: "You publish a book or in some other way cement a Memory (either current or from your Diary) in such a way that it can never be lost. Draw a star next to the Memory to indicate this and change the Memory to make it slightly less interesting. This Memory can never again be changed or struck out. It no longer takes up a Memory slot.",
        c: "A massive shift of power happens in the mortal realm. Governments fall, wars are waged, and a new order is created. Who benefits? Check a Skill. Commit atrocious deeds to gain a Resource related to controlling innocent people. Take the Skill Join the Winning Side or instead check two Skills."
    },
    34: {
        a: "You destroy something important to you in a purposeless rage. Lose a precious Memory or destroy a Resource.",
        b: "Your frenzies terrify even yourself. Do you learn to control them or instead choose to embrace this horror? Kill a mortal Character, if there is one, or create a Mark if not.",
        c: "Pull the very skin from your face in an attempt to expunge yourself of lingering humanity. Create a Mark. How do you cover your disfigurement going forward?"
    },
    35: {
        a: "You encounter the descendant of an old foe and help them in some way. Why did you do this? Check a Skill. Create a mortal Character.",
        b: "They repay your kindness by lashing out at those they perceive as your enemies. A Character is killed.",
        c: "The mortal is in grave peril. Check a Skill or lose a Resource to save them, otherwise, they die a terrible death."
    },
    36: {
        a: "The deceptions you practice fool even yourself. Combine any three Traits to fabricate an Experience that you believe to be true.",
        b: "Punish someone because of this false Memory. You kill or maim a Character. Check a Skill. Take the Skill I Know What’s Real.",
        c: "One of your real Memories turns out to be completely fabricated, a fever dream spun of cobwebs. Completely erase one Memory."
    },
    37: {
        a: "Things fall to dust. Lose a Resource for which you have no corresponding Memory. Do not create a new Experience for this Prompt, it simply happens as you stare in silence.",
        b: "You are a creature with habits of unknown origin. Lose an unchecked Skill for which you have no corresponding Memory.",
        c: "Your thoughts are calcifying, your habits are tyrants. You are nearly captured by an enemy who has been studying your patterns over many years. Break a Resource and remake it into something new and surprising."
    },
    38: {
        a: "Your whole being becomes centered in your senses and your hunger. Create a Skill that demonstrates your feral vampire nature and lose an existing Memory.",
        b: "You move differently than humans and they unconsciously sense it. Create a Mark.",
        c: "You can always find the frail, the weak, the vulnerable. Take the Skill Cull the Herd. Do not meet the eyes of the strong. They are not for you."
    },
    39: {
        a: "Age has damaged your Diary. Strikeout three nouns from the Memories in your Diary, starting from the oldest entry. If you have no Diary, do this to the first three nouns in a Memory of middling age.",
        b: "You make a new copy of your crumbling Diary. In your most recent Diary Memory, swap two verbs each for the other. If you have no Diary strike out three verbs in your most recent Memories.",
        c: "Find a character record from an earlier playthrough of this game. Swap a Memory for one from that character sheet."
    },
    40: {
        a: "How do you conceal yourself while you sleep? What steps have you taken for protection? Check a Skill and create a Resource. Create a mortal servant Character, if you like.",
        b: "You are approached by a supernatural Character unknown to you. They take you on a bizarre journey, then offer you spiritual solace in exchange for a terrible pledge. What do they demand? Will you accept? If you accept, gain a Skill.",
        c: "The potent beings which populate the spaces beyond sight have been revealed to you and nothing will ever be the same again. Let this bizarre world heavily influence the rest of your game. Take the Skill I See In-Between."
    },
    41: {
        a: "Your body is distant from human concerns. Lose a Memory slot. Erase your oldest extant name.",
        b: "A social convention or taboo from some long-forgotten part of your existence is hardwired into your being. What is it? How does this hinder your movement in society? Create a Mark.",
        c: "A ghost haunts you, though you do not know if it is real or a manifestation of madness. Bring back a long-dead Character as a spirit."
    },
    42: {
        a: "What piece of contemporary technology can you not interact with due to your vampire nature? How did your first encounter with this technology almost get you destroyed? Check a Skill.",
        b: "You make the acquaintance of a group of mortals who share an interest in some Resource you possess. Is it a club? Are these friends? Create three mortal Characters. Develop a Skill related to the Resource in question.",
        c: "Decades pass. You remain ageless as your friends slowly curl and dry up; you must leave or be exposed as a monster. Stand outside in the darkness, watching them laugh as they tell stories of how they miss you."
    },
    43: {
        a: "You have archaic ways in spite of your focus on blending in. Create a Resource based on a checked Skill that reflects this.",
        b: "Swap around the proper nouns between two Memories. Do not create an Experience about this.",
        c: "Examining a Resource you possess sparks a forgotten Memory. That Resource once belonged to another Character, but you had forgotten this. Gain tremendous insight into your history by recalling this Memory. Write this forgotten Experience into your Memory or directly into a Diary. To be clear, you are creating a new “forgotten” Experience, not bringing back a Memory you struck out."
    },
    44: {
        a: "An immortal Character you’ve met returns to claim a debt. What is it? How have they changed? Do you pay willingly? If you have a Memory of this Character you lose two Resources, if not then lose three Resources and check a Skill.",
        b: "What did they do to send you into the darkest despair? Erase your earliest Memory. You will never get it back. Gain a Skill.",
        c: "You develop a plan and carry it through with ruthless efficiency, bringing death and destruction to an immortal Character. You may either reclaim a Resource they took, or destroy them. Check a Skill."
    },
    45: {
        a: "Your body is undergoing further corruption and change. When do you first notice these new changes? Create a Mark.",
        b: "Your body is becoming more effective as it becomes less human. Create a Skill based on one of your Marks.",
        c: "You find companionship in a group of mortals who are in some way outside society. Do they know what you are? Would they care? Create two friendly mortal Characters, each related to one of your Marks."
    },
    46: {
        a: "You are exposed and flee to a far-off land. Convert any stationary Resources to a new Resource representing portable cash or treasure. What name do you travel under? What profession do you claim when you come to rest?",
        b: "You flee again, this time to a far-off enclave or colony. How do you use colonial rule to your benefit? Choose one Skill: Occupier, Insurgent, Inconspicuous, or Gone Native along with an appropriate new name.",
        c: "Revolution! As a suspicious outlander, you are imprisoned. Escape by checking two Skills or bribe your way free with two Resources. Spend an additional Resource to rescue any traveling companions."
    },
    47: {
        a: "The world has evolved in ways you can’t comprehend, causing you to lose a good amount of wealth. What happened? Check a Skill. Create a Skill that will hopefully prevent this from happening again. Lose a Resource.",
        b: "You have helpless people put in your charge. Create a Skill that helps you exploit them. Derive it from a happy Memory.",
        c: "You are impressed by the fighting spirit of one of your victims. What did they do? How do they remind you of your own earliest memories? Did they survive? Create a mortal Character."
    },
    48: {
        a: "You awaken covered in dust. Generations have passed. Your sleeping place has been sealed off. How do you escape? Lose a Resource. Strikeout all mortal Characters.",
        b: "A Mortal you thought dead is still alive, somehow. Remarkable! Bring back the most recently struck out mortal Character.",
        c: "In your long dreaming, you discover a path to lands beyond the real, a fantastic place of enormous terrors and great beauty. You may abandon this Earth and go where none may follow; leave behind all Characters, Marks, and Resources except a Silver Sword and return to Prompt 10. Proceed forward from there, an unMarked vampire in a realm of dreams. If you land on this Prompt a second time, you awaken and can never return. If you do not travel to this dreamland you instead take the Resource A Handwritten Book of Fantastic Dreams."
    },
    49: {
        a: "What simple, practical skill proves invaluable in your strange existence? How did you learn it? Create a Skill.",
        b: "How did you come to be in a place of common laborers? What previously checked Skill convinced them to accept you? What was that night of camaraderie like? Create a mortal Character. Check a Skill.",
        c: "Your new friends become a source of food. Create a Resource that reflects this."
    },
    50: {
        a: "You are captured in a trap set for predatory mortals. What sort of criminal are you taken to be? How does this experience help you learn to better prey on mortals? Make a new Skill that sours the purity of a pleasant Memory.",
        b: "You are almost uncovered and must dramatically shift your hunting patterns. Become a member of the lowest classes and lose a Resource. If you already are of the lowest classes instead become a member of the highest and check a Skill.",
        c: "You take up with predatory mortals. Create a repugnant mortal Character who becomes your associate. Even you fear these people. Why?"
    },
    51: {
        a: "When you hunger too much you become a hunting creature bereft of intellect. Lose a random Experience from a Memory somewhere in the middle of your Memory list.",
        b: "You find companionship in something that is not human. Is it an animal, or maybe something inanimate? How do you interact with it? How did you find it, or did it find you? Create either a Character or Resource to represent this companion.",
        c: "All things end, but apparently not this. A mortal Character for whom you hold great affection is un-aging. Is it magic? Some form of infection? They still count as a mortal Character, but they will never die of old age."
    },
    52: {
        a: "The beauty of the dawn calls you. Create an additional Memory slot dedicated to beauty, nature, or peace.",
        b: "You stay long enough to hear the end of a morning bird’s song. You are burned by the Sun. Create a Mark.",
        c: "Stretch out your arms, feel the warmth. The light pushes through your eyelids and you are not consumed in fire. Sunlight (or some other environmental condition) no longer harms you. Create a Skill about freedom."
    },
    53: {
        a: "A mortal Character you trusted, or one of their descendants, leads a hunting party. What shared secrets are being used against you? Check a Skill.",
        b: "You have the troublemaking Character at your mercy. Record an Experience of forgiveness.",
        c: "They betray you again and escape. Lose a Resource or gain a disfiguring Mark."
    },
    54: {
        a: "Your strange accent and old ways always reveal you as an outsider, mocked, and cheated at best or hated at worst. Smother these useless traits by converting an old Memory to a new Skill for blending in.",
        b: "Your old memories are changing to reflect the attitudes you need in the present. Change a Memory to incorporate anachronistic, contemporary aspects. Do not create a new Experience.",
        c: "Discard a Resource that is more than a hundred years old."
    },
    55: {
        a: "Timeless introspection becomes manifest in creative acts. Choose a creative Skill based on a lost Memory.",
        b: "You dedicate yourself to an art. Lose a Resource but gain back one lost Memory.",
        c: "You achieve fame for your art but must remain in shadow. Destroy a Resource in frustration. Gain a Skill."
    },
    56: {
        a: "You begin a fantastic construction that puzzles the mortals around you. Give just a hint as to its purpose. Lose a Resource and gain the Skill Visionary.",
        b: "Mortals try to prevent you from realizing your vision. Check a Skill to persevere. What awful crime did you commit to protect your construction?",
        c: "You’ve finished your construction. Why did you make this? Does it have a function? Does it change the world?"
    },
    57: {
        a: "Your knowledge of old things becomes a strength. Based on a checked Skill, what knowledge do you share with contemporary mortals? Check a Skill. Create a Resource.",
        b: "What humans seek you out for your knowledge? What do you give them? What do you take? Create a mortal Character who is smarter and more capable than you. Gain a Resource.",
        c: "You are brought to the site of one of your oldest crimes. Who brought you here? Why? Do you even remember? Check a Skill. If you have no Memory of this crime, you will be reminded."
    },
    58: {
        a: "Society has changed. How has travel become easier for you? Recover any stationary Resources for which you still have a Memory, they are re-added to your Resource list.",
        b: "What memories are unearthed by wandering these old places? Get back a lost Memory related to the stationary Resource, or gain a new treasure Resource which you’d concealed here.",
        c: "What grisly trap was set for you here? Lose a Resource, gain a Mark."
    },
    59: {
        a: "A mortal discovers the journals of a long-dead Character, or your own lost Diary, and approaches you. What do they seek? Gain a Skill or a Resource. Create a mortal Character.",
        b: "The mortal harms, shames, or exposes you. Check a Skill as you fruitlessly pursue them. Lose a Resource.",
        c: "The mortal’s lust for forbidden knowledge results in the release of a supernatural horror upon the world. Is this a gigantic monstrosity that will eventually destroy the world or a personal horror set upon destroying you in particular? Create an immortal Character or Characters."
    },
    60: {
        a: "Check a Skill to avoid arrest as a criminal. What happened? Who was arrested in your place? Create a mortal Character if necessary.",
        b: "Create an innocent mortal Character. They were executed for a crime you committed. What hobby were you tinkering with the night they were put to death? Take the Skill It’s None of my Concern.",
        c: "An entire class of people are blamed for crimes you committed. Take the Skill Always Have a Scapegoat. Who suffers in your place? Create a friendly Character who represents these people and is ignorant of your complicity. Create another Character who is in a position of authority; they know these people are innocent but do not care."
    },
    61: {
        a: "Someone reminds you of a beloved Character long dead. Check a Skill to curry their acquaintance. Create a mortal Character.",
        b: "You frequently confuse living mortals with a dead Character. Take the Mark I See [dead Character] Everywhere.",
        c: "Your body is ancient. A Mark becomes disabling. You must seek mortal assistance. Create a mortal Character who is especially capable of helping you."
    },
    62: {
        a: "You realize that some ancient taboo or limitation you long believed in no longer applies. What circumstances prompted this discovery? How does this make your existence more satisfying? Change one checked or unchecked Skill in a way that’s relevant.",
        b: "You discover a point of weakness where you were once strong. What have the ages taken from you? What causes this condition? Lose a checked Skill.",
        c: "You receive an injury which incapacitates you. Left alone you would recover, but helpful people rush you to a hospital. There you awaken and realize that you are known. Create a Character: a horrified mortal medical professional who knows exactly what you are."
    },
    63: {
        a: "How do you provide for your banal, material needs? Record an Experience about the time this went wrong. Check a Skill.",
        b: "How do you avoid the eye of the government? Create a Skill based on a Memory.",
        c: "How do you try to fool yourself into thinking you provide a valuable service to society? Take the skill Parasite."
    },
    64: {
        a: "Vast numbers of humans are migrating around the world. What group becomes easy to feed upon? How do you capitalize on their helplessness? Create a Resource.",
        b: "You manipulate society’s leaders to make one group of humans even more vulnerable to your vampiric feeding. What system do you build around victimizing these people? Check a Skill, create a relevant Skill from a Memory. Create a Character who is central to those resisting your machinations.",
        c: "Society collapses on a global scale and will not recover for centuries. Millions starve, governments dissolve, there is murder in the streets as cities burn. How do you take advantage of the chaos? Check a Skill. Create two new Resources. Create a Skill. What Character rises to a position of global leadership in these awful times?"
    },
    65: {
        a: "A possession turns out to have financial value as an antique. Trade your oldest Resource for two contemporary Resources.",
        b: "You experience intense regret over a Resource you have given away or lost. Do anything to get it back. Lose two Resources or check two Skills and get back one lost Resource.",
        c: "Objects are transient. All is nothing. Throw away your oldest or most precious Resource."
    },
    66: {
        a: "Your knowledge is outmoded. Lose an unchecked Skill which is now useless.",
        b: "Your concept of value is outdated. Lose a Resource.",
        c: "You are so ancient you no longer look like the people of today. Create a Mark that reflects this. How do you come to realize that your very body no longer fits in?"
    },
    67: {
        a: "Language itself leaves you behind. People discuss concepts you cannot grasp using tools you cannot understand. How is this problem dramatically made manifest? Create a Character who will teach you a Skill to help you offset this disadvantage.",
        b: "New forms of communication offer new ways to hunt. Modify an old Memory to include an anachronistic use of this sort of contemporary communication technology. Check a Skill, create a Skill.",
        c: "Language has grown into something outside your ken. You can invoke phonemic patterns to which mortals will react in certain ways, but you can no longer share actual thoughts or feelings or abstract ideas. Create a Skill that expresses this."
    },
    68: {
        a: "An antiquity has surfaced which is directly tied to your mortal life. Check a Skill or lose a Resource and gain the antiquity as a Resource, then regain one of your earliest Memories. Record an Experience about acquiring the antique.",
        b: "Because of this antiquity, someone has begun to hunt you. Create a mortal Character. How do they almost expose you? Check a Skill or lose a Resource.",
        c: "The mortal Character hunter corners you. You become the embodiment of one of your Checked Skills to defeat them. Take a Mark."
    },
    69: {
        a: "You bond with an ancient enemy Character over your shared past, finding in it something more comprehensible than this modern world. Check a Skill. You become friends. Share a Resource and gain a Resource that is shared with you.",
        b: "You and your friend retire to a hidden place. There you share real pleasure for the first time in centuries. Create a Skill about love and safety.",
        c: "You and your friend concoct a fantastic plan and bring it to fruition. Check a Skill. What is it? Do you conquer the world? Raise the dead? You may end the game now, if appropriate."
    },
    70: {
        a: "Mortals are cruel and work in ways outside your understanding. How were you mocked or victimized? Why was your response ineffectual and costly? Check a Skill.",
        b: "An important Memory is tainted by your exposure to the psychological tricks of contemporary society. Modify a Memory to make it less special. Lose an unchecked anti-social Skill.",
        c: "Lose a Memory. Record an Experience driven by a desire for contemporary prestige items. Lose two Resources, gain one prestigious Resource."
    },
    71: {
        a: "An immortal Character has been destroyed by mortals. How did you come to find out about this? What did you lose? Create a Skill based on a Memory. Create an immortal Character if necessary.",
        b: "How were you unintentionally responsible for this killing? What minor benefit did you gain? Gain a Resource.",
        c: "Create a false Experience about an immortal Character, which helps you make peace with your memories of them."
    },
    72: {
        a: "You are caught outside and destroyed. What happened? The game is over."
    },
    73: {
        a: "You achieve a position of absolute stability that might sustain you, unchanging, until the Sun dies. What does this mean? The game is over."
    },
    74: {
        a: "You are physically trapped in a place from which you will never be rescued. What do you think about for the first thousand years? The game is over."
    },
    75: {
        a: "An old friend or foe murders you in your sleep. What do you see in those seconds between dream and non-existence? The game is over."
    },
    76: {
        a: "A government captures you, knowing you for what you are. What do they do with you? The game is over."
    },
    77: {
        a: "Your body finally wears out. You cannot carry out your feeding patterns. What happens? The game is over."
    },
    78: {
        a: "Creatures like yourself have taken over the Earth. What is your position in this new world? The game is over."
    },
    79: {
        a: "You discover a way to become mortal. Do you take it? How will this go wrong? The game is over."
    },
    80: {
        a: "You translate yourself into a higher plane. What does this mean? The game is over."
    }
};
// ==========================================
// SETUP WIZARD SUGGESTION POOLS
// ==========================================
// Concrete, ready-to-use examples offered by the 🎲 buttons on setup steps 1–4
// for players who are stuck for ideas. Not part of the rules — purely a
// brainstorming aid (the Meaning Oracle covers the Memory steps 5–8). The name
// pool is deliberately multicultural/multi-era, since a vampire's mortal life
// could begin anywhere.
// ---------------------------------------------------------------------------
// SETTING PACKS — the "stuck for ideas" pools behind the setup wizard.
//
// Entries are grouped into coherent settings so a rolled vampire doesn't mix a
// Yoruba sire with an English thatcher and a printing press. Surprise me rolls
// ONE pack and draws everything from it; the per-step 🎲 chips then lock to
// that pack for the rest of setup (see `activePack` in app.js).
//
// Skills / resources / characters carry grammar metadata so templates can
// substitute them mid-sentence without breaking:
//   skills     { text, short }  short = lower-case form usable after "my"/"by"
//   resources  { text, short }  short = definite short form ("the hawk")
//   characters { text, name }   name  = bare name, no appositive clause
// Plain strings still work (player-typed traits); TYOV.traitForms derives the
// missing forms heuristically.
const settingPacks = [
{
    id: 'medieval-europe',
    label: 'Medieval Europe',
    names: ['Henri, son of Jon', 'Aldith of Wessex', 'Beatrix the Widow', 'Rowan Blackmoor',
            'Alise of the Loire', 'Cedric Thatcher', 'Mathilde Vance', 'Father Emil Vitrys'],
    skills: [
        { text: 'Stone Masonry', short: 'stone masonry' },
        { text: 'Reading Latin', short: 'reading Latin' },
        { text: 'Falconry', short: 'falconry' },
        { text: 'Beekeeping', short: 'beekeeping' },
        { text: 'Swordplay', short: 'swordplay' },
        { text: 'Brewing Ale', short: 'brewing ale' },
        { text: 'Haggling', short: 'haggling' },
        { text: 'Herb Lore', short: 'herb lore' }
    ],
    resources: [
        { text: 'A hawk and its jesses', short: 'the hawk' },
        { text: 'A vineyard on the hillside', short: 'the vineyard' },
        { text: 'Deed to a mill', short: 'the mill' },
        { text: 'My father’s sword', short: 'my father’s sword' },
        { text: 'A hidden cellar beneath the abbey', short: 'the hidden cellar' },
        { text: 'A purse of clipped silver', short: 'the silver' },
        { text: 'A forged patent of nobility', short: 'the forged patent' },
        { text: 'A mule and a cart', short: 'the cart' }
    ],
    characters: [
        { text: 'Old Hallam, my master smith', name: 'Old Hallam' },
        { text: 'Eliza, my sister', name: 'Eliza' },
        { text: 'Father Emil, my confessor', name: 'Father Emil' },
        { text: 'Bertrand, the tax collector', name: 'Bertrand' },
        { text: 'Rosa, the innkeeper', name: 'Rosa' },
        { text: 'Sofia, my betrothed', name: 'Sofia' },
        { text: 'The miller’s boy, Pip', name: 'Pip' },
        { text: 'Dame Ysolt, who I wronged', name: 'Dame Ysolt' }
    ],
    marks: ['My neck is permanently broken', 'I cast no reflection',
            'My hands are cold as river stones', 'A brand of my sire’s sigil over my heart',
            'My eyes catch light like a cat’s', 'Frost blooms where I sleep',
            'The wound that killed me never closed', 'Church bells set my teeth aching']
},
{
    id: 'norse-coast',
    label: 'The Norse Coast',
    names: ['Gundar Ironhand', 'Sigrid Thorsdottir', 'Halvard the Quiet', 'Ase of Bjornfjord',
            'Ketil Longshanks', 'Ingrith Salt-Hair', 'Ragnvald Crow', 'Thora Netmender'],
    skills: [
        { text: 'Sailing', short: 'sailing' },
        { text: 'Net Fishing', short: 'net fishing' },
        { text: 'Reading the Weather', short: 'reading the weather' },
        { text: 'Shipbuilding', short: 'shipbuilding' },
        { text: 'Axe Fighting', short: 'axe fighting' },
        { text: 'Rune Carving', short: 'rune carving' },
        { text: 'Whale Hunting', short: 'whale hunting' },
        { text: 'Saga Telling', short: 'saga telling' }
    ],
    resources: [
        { text: 'A fishing boat', short: 'the boat' },
        { text: 'Barrels of salted fish', short: 'the salted fish' },
        { text: 'A longhouse above the fjord', short: 'the longhouse' },
        { text: 'An arm-ring of twisted silver', short: 'the arm-ring' },
        { text: 'A whetstone from my grandfather', short: 'the whetstone' },
        { text: 'A sea-chest of foreign coins', short: 'the sea-chest' },
        { text: 'A goat herd on the headland', short: 'the goats' },
        { text: 'A carved prow, unfinished', short: 'the carved prow' }
    ],
    characters: [
        { text: 'Bjarke, my oar-mate', name: 'Bjarke' },
        { text: 'Grandmother Ilse', name: 'Grandmother Ilse' },
        { text: 'Astrid, my half-sister', name: 'Astrid' },
        { text: 'Old Sten, who taught me the tides', name: 'Old Sten' },
        { text: 'Yrsa, the völva', name: 'Yrsa' },
        { text: 'Leif, who I left behind', name: 'Leif' },
        { text: 'Torgny, my debtor', name: 'Torgny' },
        { text: 'Hilde, the smith’s widow', name: 'Hilde' }
    ],
    marks: ['Salt water weeps from my eyes', 'My skin is grey as driftwood',
            'I cast no shadow at noon', 'A rope-burn ring around my throat',
            'Gulls fall silent when I pass', 'My breath frosts even in summer',
            'Barnacle scars along my ribs', 'I cannot cross running water unaided']
},
{
    id: 'silk-road',
    label: 'The Silk Road',
    names: ['Farid al-Naddaf', 'Zarrin of Merv', 'Yusuf ibn Sahl', 'Golnar the Cartographer',
            'Timur Bekh', 'Roshanak of Balkh', 'Anwar Dast', 'Parisa Khatun'],
    skills: [
        { text: 'Cartography', short: 'cartography' },
        { text: 'Camel Driving', short: 'camel driving' },
        { text: 'Haggling in Six Tongues', short: 'haggling in six tongues' },
        { text: 'Astronomy', short: 'astronomy' },
        { text: 'Dyeing Cloth', short: 'dyeing cloth' },
        { text: 'Poisons and Antidotes', short: 'poisons and antidotes' },
        { text: 'Calligraphy', short: 'calligraphy' },
        { text: 'Desert Navigation', short: 'desert navigation' }
    ],
    resources: [
        { text: 'A caravan of twelve camels', short: 'the caravan' },
        { text: 'A bolt of imperial silk', short: 'the bolt of silk' },
        { text: 'A brass astrolabe', short: 'the astrolabe' },
        { text: 'A letter of credit from Samarkand', short: 'the letter of credit' },
        { text: 'A caravanserai at the oasis', short: 'the caravanserai' },
        { text: 'A locked chest of spices', short: 'the spice chest' },
        { text: 'Maps no one else possesses', short: 'the maps' },
        { text: 'A debt owed by a prince', short: 'the prince’s debt' }
    ],
    characters: [
        { text: 'Lucien, the moneylender', name: 'Lucien' },
        { text: 'Sahar, my caravan guide', name: 'Sahar' },
        { text: 'Master Idris, my calligraphy tutor', name: 'Master Idris' },
        { text: 'Nadia, who I wronged', name: 'Nadia' },
        { text: 'Bahram, the garrison captain', name: 'Bahram' },
        { text: 'Shirin, my wife', name: 'Shirin' },
        { text: 'The boy Kito, my apprentice', name: 'Kito' },
        { text: 'Ustad Rahim, who bought my silence', name: 'Ustad Rahim' }
    ],
    marks: ['Sand pours from my mouth when I speak too long', 'My shadow points the wrong way',
            'No mirror will hold my face', 'The sun blisters me in moments',
            'My fingertips are ink-black and will not wash', 'I leave no footprints in dust',
            'A scar shaped like a caravan route', 'Camels scream when I approach']
},
{
    id: 'sahel',
    label: 'The West African Sahel',
    names: ['Amara Nwosu', 'Kofi Adjei', 'Nadia Oyelaran', 'Salif Traoré',
            'Aminata Diallo', 'Bakary Cissé', 'Yaa Boateng', 'Ibrahim Sankara'],
    skills: [
        { text: 'Gold Assaying', short: 'gold assaying' },
        { text: 'Griot Storytelling', short: 'griot storytelling' },
        { text: 'Horsemanship', short: 'horsemanship' },
        { text: 'Salt Trading', short: 'salt trading' },
        { text: 'Ironworking', short: 'ironworking' },
        { text: 'Reading the Stars', short: 'reading the stars' },
        { text: 'Weaving Kente', short: 'weaving kente' },
        { text: 'Bow Hunting', short: 'bow hunting' }
    ],
    resources: [
        { text: 'A satchel of gold dust', short: 'the gold dust' },
        { text: 'Blocks of rock salt', short: 'the rock salt' },
        { text: 'A stable of desert horses', short: 'the horses' },
        { text: 'A compound behind the mosque', short: 'the compound' },
        { text: 'A library of borrowed manuscripts', short: 'the manuscripts' },
        { text: 'My mother’s brass anklets', short: 'my mother’s anklets' },
        { text: 'A well on the caravan road', short: 'the well' },
        { text: 'A drum that summons the village', short: 'the drum' }
    ],
    characters: [
        { text: 'Fatou, my elder sister', name: 'Fatou' },
        { text: 'Old Mansa, the griot', name: 'Old Mansa' },
        { text: 'Chike, my rival trader', name: 'Chike' },
        { text: 'Ndeye, my betrothed', name: 'Ndeye' },
        { text: 'The imam Sulayman', name: 'Sulayman' },
        { text: 'Kwame, who I wronged', name: 'Kwame' },
        { text: 'Binta, the herbalist', name: 'Binta' },
        { text: 'My uncle Modibo, the caravan master', name: 'Modibo' }
    ],
    marks: ['My voice carries an echo that is not mine', 'I have no scent at all',
            'My palms are cold and dry as clay', 'Drums fall out of rhythm near me',
            'The scar of the wound that killed me', 'Dogs will not stay in my presence',
            'My reflection lags behind me', 'Fires gutter low when I enter']
},
{
    id: 'imperial-china',
    label: 'Imperial China',
    names: ['Li Wenshu', 'Xu Baozhen', 'Chen Ruilin', 'Wang Jiao',
            'Song Yilan', 'Zhao Mingde', 'Gu Peiyu', 'Han Zhiyuan'],
    skills: [
        { text: 'Calligraphy', short: 'calligraphy' },
        { text: 'Silk Farming', short: 'silk farming' },
        { text: 'The Imperial Examinations', short: 'examination study' },
        { text: 'Acupuncture', short: 'acupuncture' },
        { text: 'Porcelain Firing', short: 'porcelain firing' },
        { text: 'Spear Drill', short: 'spear drill' },
        { text: 'Bookkeeping', short: 'bookkeeping' },
        { text: 'Reading Omens', short: 'reading omens' }
    ],
    resources: [
        { text: 'A mulberry orchard', short: 'the orchard' },
        { text: 'A kiln outside the city wall', short: 'the kiln' },
        { text: 'A minor magistrate’s seal', short: 'the seal' },
        { text: 'A courtyard house in the capital', short: 'the courtyard house' },
        { text: 'A crate of green-glazed porcelain', short: 'the porcelain' },
        { text: 'My grandfather’s medical texts', short: 'the medical texts' },
        { text: 'A moneylender’s ledger', short: 'the ledger' },
        { text: 'A jade seal of office', short: 'the jade seal' }
    ],
    characters: [
        { text: 'Auntie Mei, who raised me', name: 'Auntie Mei' },
        { text: 'Magistrate Cao, my patron', name: 'Magistrate Cao' },
        { text: 'Xiaolan, my younger brother', name: 'Xiaolan' },
        { text: 'Master Deng, my calligraphy tutor', name: 'Master Deng' },
        { text: 'Widow Shen, the silk broker', name: 'Widow Shen' },
        { text: 'Jun, who I wronged', name: 'Jun' },
        { text: 'The soldier Tie, my friend', name: 'Tie' },
        { text: 'Yueying, my betrothed', name: 'Yueying' }
    ],
    marks: ['My reflection shows me as I died', 'Ink runs whenever I write',
            'I cast no shadow by lamplight', 'My fingernails grow back black',
            'Incense will not burn in my hands', 'A cold wind follows me indoors',
            'The bruise at my throat never fades', 'Cats flee the room I enter']
},
{
    id: 'mesoamerica',
    label: 'Mesoamerica',
    names: ['Itzel Ka’an', 'Balam Tun', 'Xochitl Nahui', 'Cuauhtli Ozomatli',
            'Yaxche Ek', 'Citlali Tezca', 'Ahau Kan', 'Malinalli Quiauh'],
    skills: [
        { text: 'Reading the Codices', short: 'reading the codices' },
        { text: 'Featherwork', short: 'featherwork' },
        { text: 'Maize Farming', short: 'maize farming' },
        { text: 'Obsidian Knapping', short: 'obsidian knapping' },
        { text: 'Ball Court Play', short: 'ball court play' },
        { text: 'Star Reckoning', short: 'star reckoning' },
        { text: 'Cacao Trading', short: 'cacao trading' },
        { text: 'Temple Masonry', short: 'temple masonry' }
    ],
    resources: [
        { text: 'A sack of cacao beans', short: 'the cacao' },
        { text: 'A quetzal-feather headdress', short: 'the headdress' },
        { text: 'A terraced milpa above the town', short: 'the milpa' },
        { text: 'A cache of obsidian blades', short: 'the obsidian blades' },
        { text: 'A painted codex of my lineage', short: 'the codex' },
        { text: 'A cenote no one else knows', short: 'the cenote' },
        { text: 'A jade ear-flare from my mother', short: 'the jade ear-flare' },
        { text: 'A canoe and its trade route', short: 'the canoe' }
    ],
    characters: [
        { text: 'Ixchel, my mother', name: 'Ixchel' },
        { text: 'The priest Kanek', name: 'Kanek' },
        { text: 'Tlaloc, my ball-court rival', name: 'Tlaloc' },
        { text: 'Nicte, my betrothed', name: 'Nicte' },
        { text: 'Old Chan, the featherworker', name: 'Old Chan' },
        { text: 'Zuma, who I wronged', name: 'Zuma' },
        { text: 'My uncle Pakal, the trader', name: 'Pakal' },
        { text: 'Ek Balam, the war captain', name: 'Ek Balam' }
    ],
    marks: ['My blood will not clot', 'Obsidian dulls at my touch',
            'I cast no reflection in still water', 'The gash across my chest never heals',
            'Copal smoke bends away from me', 'My teeth are too many and too sharp',
            'Birds go silent overhead', 'My skin is cold as cave stone']
}
];

// Sentence-starter templates for the Memory steps, grouped by the kind of
// Experience each step asks for: `life` (step 5 summary), `combine` (steps 6–7,
// two traits), `turning` (step 8, names the sire). Themes are grouped the same
// way so "The Night I Died" can't land on a beekeeping memory.
//
// Tokens are resolved by TYOV.fillTemplate:
//   {skill} {resource} {character}   short mid-sentence forms
//   {Skill} {Resource} {Character}   capitalised (sentence-initial)
//   {character2}                     a SECOND, distinct character
//   {sire}                           the immortal who turned you (turning only)
// Templates are written so no token ever needs verb agreement.
const memoryTemplates = {
    themes: {
        life: ['Mortal Life', 'The House of My Father', 'Hearth and Kin', 'The Old Country',
               'Before the Cold', 'What I Was'],
        combine: ['A Debt Unpaid', 'Iron and Ash', 'Promises Broken', 'The Long Road',
                  'What I Left Behind', 'Small Cruelties', 'Ties That Held', 'The Quarrel'],
        turning: ['The Night I Died', 'First Hunger', 'Blood and Salt', 'The Cold Gift',
                  'How I Ended', 'The Last Warm Night']
    },
    life: [
        'I am {character}’s kin. I live by {skill}, and I keep {resource} close.',
        'Before the change I lived by {skill}. {Character} knew me best of anyone.',
        'I was raised among people who valued {skill}. {Resource} was all I truly owned.',
        'My whole life turned on {resource}, and on what {character} asked of me.',
        'I am known in my town for {skill}. {Character} is the one who taught me.',
        'I keep {resource} hidden, practise {skill} in secret, and tell {character} nothing.'
    ],
    combine: [
        '{Character} teaches me {skill} through the long evenings. I am clumsy at first.',
        'I use {skill} to guard {resource} on the night {character} cannot.',
        '{Character} and I quarrel bitterly over {resource}. I win, and I regret it.',
        'I trade {resource} away to save {character}, and afterwards only {skill} is left to me.',
        'When {character} falls ill, I sell {resource} and turn to {skill} to pay for the rest.',
        'I show {character} how {skill} truly works, and afterwards they never look at me the same.',
        '{Character} asks me to use {skill} against {character2}. I agree, for the price of {resource}.',
        'I lose {resource} in a wager with {character}, and win it back by {skill}.',
        'The winter {character2} dies, {character} and I keep the household alive by {skill}.'
    ],
    turning: [
        '{Sire} finds me while I am busy with {skill}. {Character} hears me scream and comes too late.',
        'I bargain with {sire} over {resource}, and lose far more than I ever offered.',
        'My skill at {skill} cannot save me from {sire}. The last thing I see is {resource}, far out of reach.',
        '{Sire} takes me in the dark, at the turning of the year. I think only of {character} as I die.',
        'I let {sire} into the house myself, because of {resource}. {Character} never learns why.',
        '{Sire} has watched me since the day I first showed my talent for {skill} in public.'
    ]
};
