'use strict';

// ======================================================
// =                        语言                        =
// ======================================================
app.factory("Unit", function($q, $http, FS, Locale, Language, Config, KV, AppVersionSrv, PATH, globalContent) {
	var Unit = function(kv) {
		var _my = this;
		_my.kv = kv || new KV("undefined", []);
		_my._changed = false;

		// Refresh un-assigned list
		_my.unassignedList = [];
		_my.refreshUnassignedList();

		// ========================================
		// =                 Prop                 =
		// ========================================
		Object.defineProperty(_my, "_name", {
			get: function() {
				return _my.kv.key;
			}, set: function(value) {
				_my.kv.key = value;
			}
		});
		Object.defineProperty(_my, "_comment", {
			get: function() {
				return _my.kv.comment;
			}, set: function(value) {
				_my.kv.comment = value;
			}
		});

		// Init
		if(!kv) {
			_my.kv.setDefault("BaseClass", "npc_dota_creature");
		}

		// Force Keep Ability
		for(var i = 1 ; i <= 17 ; i += 1) {
			_my.kv.assumeKey("Ability" + i).keep = true;
		};

		return _my;
	};

	Unit.init = function() {
		if (Unit.list) return;

		Unit.list = {};

		if(!FS) return;

		FS.readFile(PATH.normalize(AppVersionSrv.resPath + "res/items_game.json"), "utf8", function (err, data) {
			if(err) {
				$.dialog({
					title: "OPS!",
					content: "Can't load item mapping resource. 【无法加载饰品资源文件】",
				});
			} else {
				var _worker = new Worker("public/js/worker/itemWorker.js");
				_worker.onmessage = function(event) {
					Unit.list = event.data.list;
				};
				_worker.postMessage(data);
			}
		});
	};

	Unit.match = function(match) {
		match = (match || "").trim().toUpperCase();
		if(!match || !Unit.list) return [];

		var _matchList = [];
		var _maxMatch = 10;
		$.each(Unit.list, function(key, value) {
			if(!value) return;

			if(
				(key+"").toUpperCase().indexOf(match) !== -1 ||
				(value.name || "").toUpperCase().indexOf(match) !== -1 ||
				(value.image_inventory || "").toUpperCase().indexOf(match) !== -1 ||
				(value.model_player || "").toUpperCase().indexOf(match) !== -1
			) {
				_maxMatch -= 1;
				_matchList.push({
					value: key,
					_key: value.name,
				});

				if(_maxMatch < 0) return false;
			}
		});

		return _matchList;
	};

	Unit.showWearablePreview = function(key) {
		var _item = common.getValueByPath(Unit, "list." + key, null);
		if(!_item) return null;

		var _path = _item.image_inventory;

		var $content = $("<div class='text-center'>").append($("<p>").text(_item.model_player));
		var $loading = $('<i class="fa fa-refresh fa-spin"></i>').prependTo($content);

		if(_path) {
			// Cache before reborn version
			var $img = $("<img>");
			$img.attr("src", "http://git.oschina.net/zombiej/dota2-econ-heroes/raw/master/" + _path.replace("econ/", "") + ".png");
			$content.prepend($img);
			$img.load(function() {
				$loading.remove();
			});

			// Reborn version
			$img.error(function() {
				var _streamAPIKey = localStorage.getItem("streamAPIKey") || "";
				if(!_streamAPIKey) {
					$content.append($("<small class='text-warning'>").text(Locale('streamKeyNotSet')));
					$loading.remove();
				} else {
					$img.hide();
					var _name = _item.image_inventory.match(/[^\/]*$/)[0].toLowerCase();
					$http.get("https://api.steampowered.com/IEconDOTA2_570/GetItemIconPath/v1/?key=" + _streamAPIKey + "&iconname=" + _name).then(function (ret) {
						var _path = common.getValueByPath(ret, "data.result.path");
						var _url = "http://cdn.dota2.com/apps/570/" + _path;
						$img.attr("src", _url).show();
						$loading.remove();
					}, function() {
						$content.prepend($("<p class='text-danger'>").text(Locale('connectionError')));
						$loading.remove();
					});
				}
			});
		}

		$.dialog({
			title: _item.name,
			content: $content
		});
	};

	// ================================================
	// =                     解析                     =
	// ================================================
	Unit.parse = function(kvUnit) {
		var _unit = new Unit(kvUnit);
		return _unit;
	};

	// ================================================
	// =                    格式化                    =
	// ================================================
	Unit.prototype.doWriter = function(writer) {
		var _keepKV = localStorage.getItem("saveKeepKV") === "true";

		var _wearableList = this.kv.getValueByPath('Creature.AttachWearables', []);
		$.each(_wearableList, function(i, _wearable) {
			_wearable.key = "Wearable" + (i + 1);
		});

		writer.writeContent(this.kv.toString(_keepKV ? null : function(kv) {
			if(!kv.keep && (kv.value === "" || kv.key.match(/^_/))) return false;
		}));
	};

	// ================================================
	// =                寻找未定义键值                =
	// ================================================
	Unit.prototype.refreshUnassignedList = function() {
		var _my = this;
		_my.unassignedList = [];

		$.each(this.kv.value, function(i, kv) {
			var _key = (kv.key || "").toUpperCase();
			var _match = false;

			if(_key === "CREATURE") return;
			$.each(Unit.AttrList, function(i, attrList) {
				if (!attrList.value) return;

				$.each(attrList.value, function (i, attrGroup) {
					$.each(attrGroup, function (j, attrUnit) {
						if (!attrUnit.path && attrUnit.attr.toUpperCase() === _key) {
							_match = true;
							return false;
						}
					});
					if(_match) return false;
				});
				if(_match) return false;
			});

			if(!_match) {
				_my.unassignedList.push(kv);
			}
		});
	};

	// ================================================
	// =                     常量                     =
	// ================================================
	Unit.filePath = "scripts/npc/npc_units_custom.txt";
	Unit.unitConfig = ".dota2editor/unit.conf";

	Unit.heroFilePath = "scripts/npc/npc_heroes_custom.txt";
	Unit.heroConfig = ".dota2editor/hero.conf";

	// ================================================
	// =                     属性                     =
	// ================================================
	Unit.AttrCommonList = [
		[
			{group: "common", attr: "BaseClass", type: "text", showFunc: function($scope) {return !$scope.isHero;}},
			{group: "common", attr: "Model", type: "text"},
			{group: "common", attr: "Skin", type: "text"},
			{group: "common", attr: "ModelScale", type: "text"},
			{group: "common", attr: "Level", type: "text"},
			{group: "common", attr: "HasInventory", type: "single"},
			{group: "common", attr: "ConsideredHero", type: "single", showFunc: function($scope) {return !$scope.isHero;}},
		],

		[
			{group: "miniMap", attr: "MinimapIcon", type: "text"},
			{group: "miniMap", attr: "MinimapIconSize", type: "text"},
		],

		[
			{group: "bounty", attr: "BountyXP", type: "text"},
			{group: "bounty", attr: "BountyGoldMin", type: "text"},
			{group: "bounty", attr: "BountyGoldMax", type: "text"},
		],

		[
			{group: "bounds", attr: "HealthBarOffset", type: "text"},
			{group: "bounds", attr: "BoundsHullName", type: "text"},
			{group: "bounds", attr: "RingRadius", type: "text"},
		],
		[
			{group: "ai", attr: "vscripts", type: "text"},
		],
	];

	Unit.AttrHeroList = [
		[
			{group: "hero", attr: "override_hero", type: "text"},
		],
		[
			{group: "attr", attr: "AttributePrimary", type: "single"},
			{group: "attr", attr: "AttributeBaseStrength", type: "text"},
			{group: "attr", attr: "AttributeStrengthGain", type: "text"},
			{group: "attr", attr: "AttributeBaseAgility", type: "text"},
			{group: "attr", attr: "AttributeAgilityGain", type: "text"},
			{group: "attr", attr: "AttributeBaseIntelligence", type: "text"},
			{group: "attr", attr: "AttributeIntelligenceGain", type: "text"},
		],
	];

	var _match_ability = function() {
		return _match_abilityFunc;
	};
	var _match_abilityFunc = function(match) {
		if(!globalContent.abilityList) return [];
		var lang = globalContent.mainLang();
		if(!lang || !lang.kv) return [];
		match = (match || "").toUpperCase();
		return $.map(globalContent.abilityList, function(kv) {
			if((kv._name || "").toUpperCase().indexOf(match) !== -1) {
				return {
					_key: lang.kv.get(Language.abilityAttr(kv._name, ""), Config.global.kvCaseSensitive),
					value: kv._name
				};
			}
		});
	};

	Unit.AttrSoundAbilityList = [
		[
			{group: "sound", attr: "SoundSet", type: "text"},
			{group: "sound", attr: "GameSoundsFile", type: "text"},
			{group: "sound", attr: "VoiceFile", type: "text"},
			{group: "sound", attr: "IdleSoundLoop", type: "text"},
		],

		[
			{group: "ability", attr: "AbilityLayout", type: "text"},
			{group: "ability", attr: "Ability1", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability2", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability3", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability4", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability5", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability6", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability7", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability8", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability9", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability10", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability11", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability12", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability13", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability14", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability15", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability16", type: "text", match: _match_ability},
			{group: "ability", attr: "Ability17", type: "text", match: _match_ability},
		],
	];

	Unit.AttrAttackDefenseSpeedList = [
		[
			{group: "attack", attr: "AttackCapabilities", type: "single"},
			{group: "attack", attr: "AttackDamageType", type: "single"},
			{group: "attack", attr: "AttackDamageMin", type: "text"},
			{group: "attack", attr: "AttackDamageMax", type: "text"},
			{group: "attack", attr: "AttackRate", type: "text"},
			{group: "attack", attr: "AttackAnimationPoint", type: "text"},
			{group: "attack", attr: "AttackAcquisitionRange", type: "text"},
			{group: "attack", attr: "AttackRange", type: "text"},
			{group: "attack", attr: "AttackRangeBuffer", type: "text"},
		],

		[
			{group: "Projectile", attr: "ProjectileModel", type: "text", showFunc: function($scope) {return $scope.ability.kv.get("AttackCapabilities", false)  === "DOTA_UNIT_CAP_RANGED_ATTACK";}},
			{group: "Projectile", attr: "ProjectileSpeed", type: "text", showFunc: function($scope) {return $scope.ability.kv.get("AttackCapabilities", false) === "DOTA_UNIT_CAP_RANGED_ATTACK";}},
		],

		[
			{group: "armor", attr: "ArmorPhysical", type: "text"},
			{group: "armor", attr: "MagicalResistance", type: "text"},
		],

		[
			{group: "movement", attr: "MovementCapabilities", type: "single"},
			{group: "movement", attr: "MovementSpeed", type: "text"},
			{group: "movement", attr: "MovementTurnRate", type: "text"},
			{group: "movement", attr: "HasAggressiveStance", type: "boolean"},
			{group: "movement", attr: "FollowRange", type: "text"},
		],
	];

	Unit.AttrHPMPVisionList = [
		[
			{group: "status", attr: "StatusHealth", type: "text"},
			{group: "status", attr: "StatusHealthRegen", type: "text"},
			{group: "status", attr: "StatusMana", type: "text"},
			{group: "status", attr: "StatusManaRegen", type: "text"},
			{group: "status", attr: "StatusStartingMana", type: "text"},
		],

		[
			{group: "Vision", attr: "VisionDaytimeRange", type: "text"},
			{group: "Vision", attr: "VisionNighttimeRange", type: "text"},
		],
	];

	Unit.AttrOtherList = [
		[
			{group: "label", attr: "UnitLabel", type: "text"},
		],

		[
			{group: "Behavior", attr: "UseNeutralCreepBehavior", type: "boolean"},
		],

		[
			{group: "others", attr: "IsAncient", type: "boolean"},
			{group: "others", attr: "IsNeutralUnitType", type: "boolean"},
			{group: "others", attr: "CanBeDominated", type: "single"},
			{group: "others", attr: "AutoAttacksByDefault", type: "single"},
			{group: "others", attr: "ShouldDoFlyHeightVisual", type: "single"},
			{group: "others", attr: "WakesNeutrals", type: "boolean"},
		],

		[
			{group: "AttackDefend", attr: "CombatClassAttack", type: "single"},
			{group: "AttackDefend", attr: "CombatClassDefend", type: "single"},
		],

		[
			{group: "Team", attr: "TeamName", type: "text"},
			{group: "Team", attr: "UnitRelationShipClass", type: "single"},
			{group: "Team", attr: "SelectionGroup", type: "text"},
			{group: "Team", attr: "SelectOnSpawn", type: "boolean"},
			{group: "Team", attr: "IgnoreAddSummonedToSelection", type: "boolean"},
		],
	];

	Unit.AttrCreatureList = [
		[
			{group: "Common", path: "Creature", attr: "DisableClumpingBehavior", type: "boolean"},
			{group: "Common", path: "Creature", attr: "CanRespawn", type: "boolean"},
			{group: "Common", path: "Creature", attr: "DisableResistance", type: "text"},
		],

		[
			{group: "Level", path: "Creature", attr: "HPGain", type: "text"},
			{group: "Level", path: "Creature", attr: "DamageGain", type: "text"},
			{group: "Level", path: "Creature", attr: "ArmorGain", type: "text"},
			{group: "Level", path: "Creature", attr: "MagicResistGain", type: "text"},
			{group: "Level", path: "Creature", attr: "MoveSpeedGain", type: "text"},
			{group: "Level", path: "Creature", attr: "BountyGain", type: "text"},
			{group: "Level", path: "Creature", attr: "XPGain", type: "text"},
		],
	];

	Unit.AttrList = [
		{name: "Common", value: Unit.AttrCommonList},
		{name: "Hero", value: Unit.AttrHeroList, showFunc: function($scope) {return $scope.isHero;}},
		{name: "SoundAbility", value: Unit.AttrSoundAbilityList},
		{name: "AttackDefenseSpeed", value: Unit.AttrAttackDefenseSpeedList},
		{name: "HPMPVision", value: Unit.AttrHPMPVisionList},
		{name: "Creature", value: Unit.AttrCreatureList, showFunc: function($scope) {return $scope.ability && $scope.ability.kv.get("BaseClass", false) === "npc_dota_creature";}},
		{name: "Wearable", showFunc: function($scope) {return $scope.ability && $scope.ability.kv.get("BaseClass", false) === "npc_dota_creature";}},
		{name: "Others", value: Unit.AttrOtherList},
		{name: "Unassigned"},
	];

	// ================================================
	// =                     枚举                     =
	// ================================================
	Unit.BaseClass = [
		{value: "npc_dota_base"},
		{value: "npc_dota_base_additive"},
		{value: "npc_dota_creature"},
		{value: "npc_dota_companion"},
		{value: "npc_dota_courier"},
		{value: "npc_dota_flying_courier"},
		{value: "npc_dota_fort"},
		{value: "npc_dota_thinker"},
		{value: "npc_dota_building"},
		{value: "npc_dota_tower"},
		{value: "npc_dota_tusk_frozen_sigil"},
		{value: "npc_dota_roshan"},
		{value: "npc_dota_elder_titan_ancestral_spirit"},
		{value: "npc_dota_creep"},
		{value: "npc_dota_creep_lane"},
		{value: "npc_dota_creep_siege"},
		{value: "npc_dota_creep_neutral"},
		{value: "npc_dota_ward_base"},
		{value: "npc_dota_ward_base_truesight"},
		{value: "ent_dota_fountain"},
	];

	Unit.HasInventory = Unit.ConsideredHero = Unit.CanBeDominated = Unit.AutoAttacksByDefault = Unit.ShouldDoFlyHeightVisual = [
		["0"],
		["1"],
	];

	Unit.BoundsHullName = [
		{value: "DOTA_HULL_SIZE_SMALL", _key: "8"},
		{value: "DOTA_HULL_SIZE_REGULAR", _key: "16"},
		{value: "DOTA_HULL_SIZE_SIEGE", _key: "16"},
		{value: "DOTA_HULL_SIZE_HERO", _key: "24"},
		{value: "DOTA_HULL_SIZE_HUGE", _key: "80"},
		{value: "DOTA_HULL_SIZE_BUILDING", _key: "81"},
		{value: "DOTA_HULL_SIZE_FILLER", _key: "96"},
		{value: "DOTA_HULL_SIZE_BARRACKS", _key: "144"},
		{value: "DOTA_HULL_SIZE_TOWER", _key: "144"},
	];

	Unit.AttackCapabilities = [
		["DOTA_UNIT_CAP_NO_ATTACK"],
		["DOTA_UNIT_CAP_MELEE_ATTACK"],
		["DOTA_UNIT_CAP_RANGED_ATTACK"],
	];

	Unit.AttackDamageType = [];

	Unit.AttributePrimary = [
		["DOTA_ATTRIBUTE_AGILITY"],
		["DOTA_ATTRIBUTE_INTELLECT"],
		["DOTA_ATTRIBUTE_STRENGTH"],
	];

	Unit.MovementCapabilities = [
		["DOTA_UNIT_CAP_MOVE_NONE"],
		["DOTA_UNIT_CAP_MOVE_GROUND"],
		["DOTA_UNIT_CAP_MOVE_FLY"],
	];

	Unit.CombatClassAttack = [
		["DOTA_COMBAT_CLASS_ATTACK_BASIC"],
		["DOTA_COMBAT_CLASS_ATTACK_HERO"],
		["DOTA_COMBAT_CLASS_ATTACK_LIGHT"],
		["DOTA_COMBAT_CLASS_ATTACK_PIERCE"],
		["DOTA_COMBAT_CLASS_ATTACK_SIEGE"],
	];

	Unit.CombatClassDefend = [
		["DOTA_COMBAT_CLASS_DEFEND_BASIC"],
		["DOTA_COMBAT_CLASS_DEFEND_HERO"],
		["DOTA_COMBAT_CLASS_DEFEND_SOFT"],
		["DOTA_COMBAT_CLASS_DEFEND_STRONG"],
		["DOTA_COMBAT_CLASS_DEFEND_STRUCTURE"],
		["DOTA_COMBAT_CLASS_DEFEND_WEAK"],
	];

	Unit.UnitRelationShipClass = [
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_DEFAULT"],
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_BARRACKS"],
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_BUILDING"],
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_COURIER"],
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_HERO"],
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_SIEGE"],
		["DOTA_NPC_UNIT_RELATIONSHIP_TYPE_WARD"],
	];

	return Unit;
});