﻿'use strict';

// ======================================================
// =                        技能                        =
// ======================================================
app.factory("Ability", function($q, Event, Modifier) {
	var Ability = function(kv) {
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

		// Set Default
		if(!kv) {
			_my.kv.setDefault("BaseClass", "ability_datadriven");
		}

		// Event List
		_my._eventList = [];

		// Modifier
		_my._modifier = _my.kv.assumeKey("Modifiers", true);

		// Ability Special
		_my._special = _my.kv.assumeKey("AbilitySpecial", true);

		return _my;
	};

	// Get
	Ability.prototype.get = function(key) {
		return this.kv.get(key, false);
	};

	// Has
	Ability.prototype.has = function(key, value) {
		var _list = (this.get(key) || "").split("|");
		var _has = false;

		$.each(_list, function(i, line) {
			if(line.trim() === value.trim()) {
				_has = true;
				return false;
			}
		});

		return _has;
	};

	// Get Events
	Ability.prototype.getEventList = function() {
		var _my = this;
		_my._eventList.splice(0);
		$.each(_my.kv.value, function(i, kv) {
			if(kv._isEvent || common.array.find(kv.key, Event.ModifierEventList, "value", false, false)) {
				kv._isEvent = true;
				_my._eventList.push(kv);
			}
		});
		return _my._eventList;
	};

	// Get Modifiers
	Ability.prototype.getModifierList = function() {
		return this.kv.get("Modifiers", false) || [];
	};

	// Get Ability Special
	Ability.prototype.getSpecialList = function() {
		return this.kv.get("AbilitySpecial", false) || [];
	};

	// Get Pre-cache
	Ability.prototype.getPrecacheList = function() {
		return this.kv.get("precache", false) || [];
	};

	// Get unassigned list
	Ability.prototype.refreshUnassignedList = function() {
		var _my = this;
		var _attrList = Ability.getCommonAttrList();
		var _unassignedList = _my.unassignedList = [];

		$.each(this.kv.value, function(i, kv) {
			if(
				!common.array.find(kv.key, _attrList, "", false, false) &&
				!common.array.find(kv.key, Event.ModifierEventList, "value", false, false) &&
				!kv._isEvent
			) {
				_unassignedList.push(kv);
			}
		});
	};

	// Get KV Pre-cache list
	Ability.prototype.getKVPrecacheList = function() {
		var _list = [];

		// Particle File
		// Sound File
		// TODO: model File

		$.each(this.getEventList(), function(i, eventKV) {
			_list = _list.concat(Event(eventKV).getKVPrecacheList());
		});

		$.each(this.getModifierList(), function(i, modifierKV) {
			_list = _list.concat(Modifier(modifierKV).getKVPrecacheList());
		});

		return _list;
	};

	// =================================================
	// =                     Const                     =
	// =================================================
	Ability.filePath = "scripts/npc/npc_abilities_custom.txt";
	Ability.exportFilePath = "scripts/npc/npc_abilities_custom.txt";

	Ability.itemFilePath = "scripts/npc/npc_items_custom.txt";
	Ability.exportItemFilePath = "scripts/npc/npc_items_custom.txt";

	Ability.abilityConfig = ".dota2editor/ability.conf";
	Ability.itemConfig = ".dota2editor/item.conf";

	// =================================================
	// =                     Parse                     =
	// =================================================
	Ability.parse = function(kvUnit) {
		var _unit = new Ability(kvUnit);

		// Init modifier
		$.each(_unit.getModifierList(), function(i, modifierKV) {
			Modifier(modifierKV);
		});

		// Clean kv pre-cache
		var _precacheList = _unit.getPrecacheList();
		var _kvPrecacheList = _unit.getKVPrecacheList();
		$.each(_kvPrecacheList, function(i, kv) {
			var _precache = common.array.find(kv.value, _precacheList, "value");
			common.array.remove(_precache, _precacheList);
		});

		return _unit;
	};

	// ================================================
	// =                    Format                    =
	// ================================================
	// TODO: Save Logic
	// Order

	Ability.prototype.doWriter = function(writer) {
		var _keepKV = localStorage.getItem("saveKeepKV") === "true";

		// ==========> Prepare
		// Pre-Cache
		var _pre_precacheList = this.getPrecacheList();
		var _pre_kvPrecacheList = this.getKVPrecacheList();
		var _merge_precacheList = _pre_precacheList.concat(_pre_kvPrecacheList);
		if(_merge_precacheList.length === 0) {
			this.kv.delete("precache");
		} else {
			this.kv.assumeKey("precache", true).value = _merge_precacheList;
		}

		// Order
		var _ori_kvList = this.kv.value;
		var commonAttrList = Ability.getCommonAttrList();
		var _kvList = _ori_kvList.slice();
		var _orderList = [];
		$.each(commonAttrList, function(i, attr) {
			if(attr === "_EVENT_LIST") {
				// Event special process to keep the event order
				$.each(_kvList.slice(), function(j, attrItem) {
					if(common.array.find(attrItem.key, Event.ModifierEventList, "value", false, false) || attrItem._isEvent) {
						_orderList.push(attrItem);
						common.array.remove(attrItem, _kvList);
					}
				});
			} else {
				// Match attr
				$.each(common.array.find(attr, _kvList, "key", true, false), function (i, attrItem) {
					_orderList.push(attrItem);
					common.array.remove(attrItem, _kvList);
				});
			}
		}.bind(this));
		_orderList = _orderList.concat(_kvList);
		this.kv.value = _orderList;

		// Special Ability
		$.each(this.getSpecialList(), function(i, specialKV) {
			specialKV.key = common.text.preFill((i + 1), "0", 2);
		});

		// Event process
		$.each(this.getEventList(), function(i, event) {
			if(!(event.key + "").trim()) return;
			Event(event).saveProcess();
		});

		// Modifier process
		if(this.getModifierList().length !== 0) {
			$.each(this.getModifierList(), function (i, modifier) {
				Modifier(modifier).saveProcess();
			});
		} else {
			this.kv.delete("Modifiers");
		}

		// Ability Special
		if((this.kv.get("AbilitySpecial") || []).length === 0) {
			this.kv.delete("AbilitySpecial");
		}

		// ==========> Write
		writer.writeContent(this.kv.toString(_keepKV ? null : function(kv) {
			if(kv.key === "" || kv.value === "" || kv.key.match(/^_/)) return false;
		}));

		// ==========> Clean Up
		// Pre-Cache
		this.kv.assumeKey("precache", true).value = _pre_precacheList;

		// Order
		this.kv.value = _ori_kvList;
	};

	// ================================================
	// =                  Attr List                   =
	// ================================================
	var _channelFunc = function($scope) {
		return $scope.ability && $scope.ability.has("AbilityBehavior", "DOTA_ABILITY_BEHAVIOR_CHANNELLED");
	 };

	Ability.AttrList = [
		[
			{group: "common", attr: "BaseClass", type: "text", defaultValue: "ability_datadriven"},
			{group: "common", attr: "AbilityTextureName", type: "text"},
			{
				group: "common", attr: "ScriptFile", type: "text", showFunc: function ($scope) {
				var baseClass = $scope.ability.get("BaseClass");
				return $scope.ability && (baseClass === "ability_lua" || baseClass === "item_lua");
			}
			},
			{group: "common", attr: "AbilityBehavior", type: "group"}
		],
		[
			{group: "target", attr: "AbilityUnitTargetType", type: "group"},
			{
				group: "target",
				attr: "AbilityUnitTargetTeam",
				type: "single",
				defaultValue: "DOTA_UNIT_TARGET_TEAM_NONE"
			},
			{group: "target", attr: "AbilityUnitTargetFlags", type: "group"},
			{group: "target", attr: "AbilityUnitDamageType", type: "single"},
			{group: "target", attr: "SpellImmunityType", type: "single"},
			{group: "target", attr: "SpellDispellableType", type: "single"},
			{group: "target", attr: "CastFilterRejectCaster", type: "boolean"},
			{group: "target", attr: "FightRecapLevel", type: "text"}
		],
		[
			{group: "skill", attr: "AbilityType", type: "single", defaultValue: "DOTA_ABILITY_TYPE_BASIC"},
			{group: "skill", attr: "HotKeyOverride", type: "text"},
			{group: "skill", attr: "MaxLevel", type: "text"},
			{group: "skill", attr: "RequiredLevel", type: "text"},
			{group: "skill", attr: "LevelsBetweenUpgrades", type: "text"}
		],
		[
			{group: "animation", attr: "AbilityCastPoint", type: "text"},
			{group: "animation", attr: "AbilityCastAnimation", type: "text"},
			{group: "animation", attr: "AnimationPlaybackRate", type: "text"}
		],
		[
			{group: "usage", attr: "AbilityCooldown", type: "text"},
			{group: "usage", attr: "AbilityManaCost", type: "text"},
			{group: "usage", attr: "AbilityCastRange", type: "text"},
			{group: "usage", attr: "AbilityCastRangeBuffer", type: "text"},
			{group: "usage", attr: "AbilityChannelTime", type: "text", showFunc: _channelFunc},
			{group: "usage", attr: "AbilityChannelledManaCostPerSecond", type: "text", showFunc: _channelFunc},
			{
				group: "usage", attr: "AOERadius", type: "text", showFunc: function ($scope) {
					return $scope.ability && $scope.ability.has("AbilityBehavior", "DOTA_ABILITY_BEHAVIOR_AOE");
				}
			}
		]
	];

	Ability.ItemAttrList = [
		[
			{group: "item", attr: "ID", type: "text"},
			{group: "item", attr: "ItemQuality", type: "single"},
			{group: "item", attr: "ItemCastOnPickup", type: "boolean", defaultValue: false}
		],
		[
			{group: "item", attr: "Model", type: "text"},
			{group: "item", attr: "Effect", type: "text"}
		],
		[
			{group: "item", attr: "ItemCost", type: "text"},
			{group: "item", attr: "ItemDroppable", type: "boolean", defaultValue: true},
			{group: "item", attr: "ItemSellable", type: "boolean", defaultValue: true},
			{group: "item", attr: "ItemShareability", type: "single"},
			{group: "item", attr: "ItemPurchasable", type: "single"},
			{group: "item", attr: "ItemDeclarations", type: "single"},
			{group: "item", attr: "ItemKillable", type: "boolean", defaultValue: true},
			{group: "item", attr: "ItemAlertable", type: "boolean", defaultValue: false},
			{group: "item", attr: "ItemPermanent", type: "single"}
		],
		[
			{group: "item", attr: "ItemRequiresCharges", type: "single"},
			{group: "item", attr: "ItemInitialCharges", type: "text"},
			{group: "item", attr: "ItemStackable", type: "boolean", defaultValue: false}
		],
		[
			{group: "item", attr: "SideShop", type: "text"},
			{group: "item", attr: "SecretShop", type: "text"},
			{group: "item", attr: "ItemShopTags", type: "text"},
			{group: "item", attr: "ItemAliases", type: "text"}
		],
		[
			{group: "item", attr: "ItemStockMax", type: "text"},
			{group: "item", attr: "ItemStockTime", type: "text"},
			{group: "item", attr: "ItemStockInitial", type: "text"},
		],

		[
			{group: "item", attr: "MaxUpgradeLevel", type: "text"},
			{group: "item", attr: "ItemBaseLevel", type: "text"}
		],
		[
			{group: "item", attr: "ItemRecipe", type: "boolean", defaultValue: false},
			{group: "item", attr: "ItemResult", type: "text"},
			{group: "item", attr: "ItemRequirements", type: "tree"},  // TODO: 合成公式！
			{group: "item", attr: "ItemDisassembleRule", type: "single"}
		],
	];

	// Flatten for easy usage
	Ability.getCommonAttrList = function() {
		var _list = [];
		$.each(Ability.AttrList.concat(Ability.ItemAttrList), function(i, grpList) {
			$.each(grpList, function(j, attrField) {
				_list.push(attrField.attr);
			});
		});

		_list.push("precache");

		// Events
		_list.push("_EVENT_LIST");

		_list.push("Modifiers");
		_list.push("AbilitySpecial");

		return _list;
	};

	// ================================================
	// =                     Enum                     =
	// ================================================
	Ability.BaseClass = [
		{value: "ability_datadriven"},
		{value: "ability_lua"}
	];

	Ability.ItemShareability = [
		["ITEM_FULLY_SHAREABLE"],
		["ITEM_FULLY_SHAREABLE_STACKING"],
		["ITEM_NOT_SHAREABLE"],
		["ITEM_PARTIALLY_SHAREABLE"],
	];

	Ability.ItemDeclarations = [
		["DECLARE_PURCHASES_IN_SPEECH"],
		["DECLARE_PURCHASES_TO_SPECTATORS"],
		["DECLARE_PURCHASES_TO_TEAMMATES"],
	];

	Ability.ItemQuality = [
		["component"],
		["rare"],
		["epic"],
		["common"],
		["consumable"],
		["secret_shop"],
		["artifact"]
	];
	Ability.ItemQuality.color = {
		"component": "#FFFFFF",
		"rare": "#00C0EF",
		"epic": "#CC33FF",
		"common": "#33FF00",
		"consumable": "#FFFFFF",
		"secret_shop": "#00CCCC",
		"artifact": "#FF9900"
	};

	Ability.ItemDisassembleRule = [
		["DOTA_ITEM_DISASSEMBLE_ALWAYS"],
		["DOTA_ITEM_DISASSEMBLE_NEVER"]
	];

	Ability.ItemPurchasable = Ability.ItemPermanent = Ability.ItemRequiresCharges = [
		["0"],
		["1"],
	];

	Ability.AbilityBehavior = [
		["DOTA_ABILITY_BEHAVIOR_IMMEDIATE",true],
		["DOTA_ABILITY_BEHAVIOR_HIDDEN", true],
		["DOTA_ABILITY_BEHAVIOR_PASSIVE", true],
		["DOTA_ABILITY_BEHAVIOR_NO_TARGET", true],
		["DOTA_ABILITY_BEHAVIOR_UNIT_TARGET", true],
		["DOTA_ABILITY_BEHAVIOR_POINT", true],
		["DOTA_ABILITY_BEHAVIOR_AOE", true],
		["DOTA_ABILITY_BEHAVIOR_CHANNELLED", true],
		["DOTA_ABILITY_BEHAVIOR_NOT_LEARNABLE"],
		["DOTA_ABILITY_BEHAVIOR_ITEM"],
		["DOTA_ABILITY_BEHAVIOR_TOGGLE"],
		["DOTA_ABILITY_BEHAVIOR_DIRECTIONAL"],
		["DOTA_ABILITY_BEHAVIOR_AUTOCAST"],
		["DOTA_ABILITY_BEHAVIOR_NOASSIST"],
		["DOTA_ABILITY_BEHAVIOR_AURA"],
		["DOTA_ABILITY_BEHAVIOR_ATTACK"],
		["DOTA_ABILITY_BEHAVIOR_DONT_RESUME_MOVEMENT"],
		["DOTA_ABILITY_BEHAVIOR_ROOT_DISABLES"],
		["DOTA_ABILITY_BEHAVIOR_UNRESTRICTED"],
		["DOTA_ABILITY_BEHAVIOR_IGNORE_PSEUDO_QUEUE"],
		["DOTA_ABILITY_BEHAVIOR_IGNORE_CHANNEL"],
		["DOTA_ABILITY_BEHAVIOR_DONT_CANCEL_MOVEMENT"],
		["DOTA_ABILITY_BEHAVIOR_DONT_ALERT_TARGET"],
		["DOTA_ABILITY_BEHAVIOR_DONT_RESUME_ATTACK"],
		["DOTA_ABILITY_BEHAVIOR_NORMAL_WHEN_STOLEN"],
		["DOTA_ABILITY_BEHAVIOR_IGNORE_BACKSWING"],
		["DOTA_ABILITY_BEHAVIOR_RUNE_TARGET"],
		["DOTA_ABILITY_BEHAVIOR_DONT_CANCEL_CHANNEL"],
		["DOTA_ABILITY_BEHAVIOR_OPTIONAL_UNIT_TARGET"],
		["DOTA_ABILITY_BEHAVIOR_OPTIONAL_NO_TARGET"],
	];

	Ability.AbilityUnitTargetType = [
		["DOTA_UNIT_TARGET_HERO", true],
		["DOTA_UNIT_TARGET_BASIC", true],
		["DOTA_UNIT_TARGET_ALL"],
		["DOTA_UNIT_TARGET_BUILDING"],
		["DOTA_UNIT_TARGET_COURIER"],
		["DOTA_UNIT_TARGET_CREEP"],
		["DOTA_UNIT_TARGET_CUSTOM"],
		["DOTA_UNIT_TARGET_MECHANICAL"],
		["DOTA_UNIT_TARGET_NONE"],
		["DOTA_UNIT_TARGET_OTHER"],
		["DOTA_UNIT_TARGET_TREE"],
	];

	Ability.AbilityUnitTargetTeam = [
		["DOTA_UNIT_TARGET_TEAM_BOTH", true],
		["DOTA_UNIT_TARGET_TEAM_ENEMY", true],
		["DOTA_UNIT_TARGET_TEAM_FRIENDLY", true],
		["DOTA_UNIT_TARGET_TEAM_CUSTOM"],
		["DOTA_UNIT_TARGET_TEAM_NONE"],
	];

	Ability.AbilityUnitTargetFlags = [
		["DOTA_UNIT_TARGET_FLAG_CHECK_DISABLE_HELP"],
		["DOTA_UNIT_TARGET_FLAG_DEAD"],
		["DOTA_UNIT_TARGET_FLAG_FOW_VISIBLE"],
		["DOTA_UNIT_TARGET_FLAG_INVULNERABLE"],
		["DOTA_UNIT_TARGET_FLAG_MAGIC_IMMUNE_ENEMIES"],
		["DOTA_UNIT_TARGET_FLAG_MANA_ONLY"],
		["DOTA_UNIT_TARGET_FLAG_MELEE_ONLY"],
		["DOTA_UNIT_TARGET_FLAG_NO_INVIS"],
		["DOTA_UNIT_TARGET_FLAG_NONE"],
		["DOTA_UNIT_TARGET_FLAG_NOT_ANCIENTS"],
		["DOTA_UNIT_TARGET_FLAG_NOT_ATTACK_IMMUNE"],
		["DOTA_UNIT_TARGET_FLAG_NOT_CREEP_HERO"],
		["DOTA_UNIT_TARGET_FLAG_NOT_DOMINATED"],
		["DOTA_UNIT_TARGET_FLAG_NOT_ILLUSIONS"],
		["DOTA_UNIT_TARGET_FLAG_NOT_MAGIC_IMMUNE_ALLIES"],
		["DOTA_UNIT_TARGET_FLAG_NOT_NIGHTMARED"],
		["DOTA_UNIT_TARGET_FLAG_NOT_SUMMONED"],
		["DOTA_UNIT_TARGET_FLAG_OUT_OF_WORLD"],
		["DOTA_UNIT_TARGET_FLAG_PLAYER_CONTROLLED"],
		["DOTA_UNIT_TARGET_FLAG_RANGED_ONLY"],
		["DOTA_UNIT_TARGET_FLAG_PREFER_ENEMIES"]
	];

	Ability.AbilityUnitDamageType = [
		["DAMAGE_TYPE_MAGICAL",true],
		["DAMAGE_TYPE_PHYSICAL",true],
		["DAMAGE_TYPE_PURE",true],
	];

	Ability.SpellImmunityType = [
		["SPELL_IMMUNITY_NONE",true],
		["SPELL_IMMUNITY_ALLIES_YES",false],
		["SPELL_IMMUNITY_ALLIES_NO",false],
		["SPELL_IMMUNITY_ENEMIES_YES",false],
		["SPELL_IMMUNITY_ENEMIES_NO",false]
	];

	Ability.SpellDispellableType = [
		["SPELL_DISPELLABLE_NO"],
		["SPELL_DISPELLABLE_YES"],
		["SPELL_DISPELLABLE_YES_STRONG"]
	];

	Ability.AbilityType = [
		["DOTA_ABILITY_TYPE_BASIC",true],
		["DOTA_ABILITY_TYPE_ULTIMATE"],
		["DOTA_ABILITY_TYPE_ATTRIBUTES"],
		["DOTA_ABILITY_TYPE_HIDDEN"],
	];

	Ability.AbilityCastAnimation = [
		{value: "ACT_DOTA_ATTACK", suggest: true},
		{value: "ACT_DOTA_CAST_ABILITY_1", suggest: true},
		{value: "ACT_DOTA_CAST_ABILITY_1_END"},
		{value: "ACT_DOTA_CHANNEL_ABILITY_1"},
		{value: "ACT_DOTA_DISABLED"},
		{value: "ACT_DOTA_RUN"},
		{value: "ACT_DOTA_SPAWN"},
		{value: "ACT_DOTA_TELEPORT"},
		{value: "ACT_DOTA_VICTORY"},
	];

	Ability.AbilitySpecialType = [
		["FIELD_INTEGER", true],
		["FIELD_FLOAT", true],
	];

	return Ability;
});