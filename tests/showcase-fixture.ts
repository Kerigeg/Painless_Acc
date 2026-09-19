// Synthetic data shaped like the documented API; never shown as a live result.
export const showcaseFixture = () => ({
  uid: "123456789",
  fetchedAt: "2026-09-19T02:00:00.000Z",
  ttl: 60,
  cached: false,
  playerInfo: { nickname: "测试旅人", level: 55, worldLevel: 8 },
  characters: {
    "10000031-3101": {
      NameTextMapHash: 10,
      SkillOrder: [1, 2, 3],
      ProudMap: { 1: 11, 2: 12, 3: 13 },
    },
  },
  names: { 10: "菲谢尔", 20: "测试弓", 30: "测试套装" },
  avatarInfoList: [
    {
      avatarId: 10000031,
      skillDepotId: 3101,
      propMap: { "4001": { val: "90" }, "1002": { val: "6" } },
      skillLevelMap: { 1: 1, 2: 8, 3: 6 },
      proudSkillExtraLevelMap: { 12: 3 },
      fightPropMap: {
        "2000": 12345,
        "2001": 2000,
        "2002": 700,
        "28": 120,
        "20": 0.55,
        "22": 1.2,
        "23": 1.4,
      },
      equipList: [
        {
          itemId: 100,
          weapon: { level: 90, promoteLevel: 6, affixMap: { 1: 4 } },
          flat: { nameTextMapHash: "20" },
        },
        {
          itemId: 200,
          reliquary: { level: 21 },
          flat: {
            equipType: "EQUIP_RING",
            setNameTextMapHash: "30",
            rankLevel: 5,
            reliquaryMainstat: {
              mainPropId: "FIGHT_PROP_ELEC_ADD_HURT",
              statValue: 46.6,
            },
            reliquarySubstats: [
              { appendPropId: "FIGHT_PROP_CRITICAL", statValue: 10.5 },
            ],
          },
        },
      ],
    },
  ],
});
