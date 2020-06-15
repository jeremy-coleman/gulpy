export default {
  label: "Tasks",
  nodes: [
    {
      label: "fn1",
      type: "task",
      nodes: [],
    },
    {
      label: "fn2",
      type: "task",
      nodes: [],
    },
    {
      label: "fn3",
      type: "task",
      nodes: [
        {
          label: "<series>",
          type: "function",
          branch: true,
          nodes: [
            {
              label: "fn1",
              type: "task",
              nodes: [],
            },
            {
              label: "fn2",
              type: "task",
              nodes: [],
            },
          ],
        },
      ],
    },
  ],
}
